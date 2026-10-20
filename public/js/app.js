// 스마트 옷장(OFYC) 프런트엔드. 데이터는 모두 서버(Neon)에 저장하고,
// 로그인은 서버가 발급한 HttpOnly 세션 쿠키로 유지하고,
// localStorage에는 다음 로그인 때 채워 둘 아이디만 기억한다.
import { colorName, hexToHsl, HEX_RE } from './color.js';
import { preparePhoto, PhotoError } from './photo.js';

const ID_KEY = 'smart-closet-code'; // 마지막으로 로그인한 아이디 (예전 버전과 같은 키)
const CATEGORIES = [
  { value: 'top', label: '상의', en: 'Top', icon: 'apparel' },
  { value: 'bottom', label: '하의', en: 'Bottom', icon: 'straighten' },
  { value: 'outer', label: '아우터', en: 'Outer', icon: 'dry_cleaning' },
  { value: 'shoes', label: '신발', en: 'Shoes', icon: 'steps' },
];
const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));
const THICKNESS = [
  { value: 'thin', label: '얇음', season: 'Spring / Summer', range: '17°C 이상 코디', icon: 'wb_sunny' },
  { value: 'medium', label: '보통', season: 'Four Seasons', range: '5~22°C 코디', icon: 'device_thermostat' },
  { value: 'thick', label: '두꺼움', season: 'Late Autumn / Winter', range: '9°C 이하 코디', icon: 'ac_unit' },
];
const THICK = Object.fromEntries(THICKNESS.map((t) => [t.value, t]));
const PRESETS = [
  ['Black', '#111111'], ['Ivory', '#F5F0E1'], ['Camel', '#C19A6B'], ['Navy', '#1F2A44'],
  ['Charcoal', '#36454F'], ['Burgundy', '#6B1A2A'], ['Mocha', '#6F4E37'], ['Olive', '#5F6B3A'],
];
const COLOR_EN = {
  블랙: 'Black', 차콜: 'Charcoal', 그레이: 'Grey', 라이트그레이: 'Light Grey', 화이트: 'White',
  아이보리: 'Ivory', 베이지: 'Beige', 카멜: 'Camel', 브라운: 'Brown', 카키: 'Khaki', 올리브: 'Olive',
  네이비: 'Navy', 블루: 'Blue', 데님: 'Denim', 스카이블루: 'Sky Blue', 그린: 'Green', 민트: 'Mint',
  레드: 'Red', 버건디: 'Burgundy', 핑크: 'Pink', 오렌지: 'Orange', 옐로우: 'Yellow', 퍼플: 'Purple', 라벤더: 'Lavender',
};
const RULE_STYLE = {
  '무채색 포함': 'Monochrome Balance',
  '톤온톤': 'Tone on Tone',
  '유사색': 'Analogous Harmony',
  '보색 포인트': 'Complementary Accent',
  '강한 보색 충돌': 'Bold Contrast',
};
const PIECE_ORDER = ['outer', 'top', 'bottom', 'shoes'];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const state = {
  id: null, view: 'today', clothes: [], loaded: false,
  filter: { category: '', color: '', thickness: '', q: '' },
  combos: [], temperature: null,
  form: { category: 'top', thickness: 'medium', color: '#1F2A44' },
};

// ── 유틸 ─────────────────────────────────────────────
function storedId() {
  try { return localStorage.getItem(ID_KEY); } catch { return null; }
}
function storeId(id) {
  try { id ? localStorage.setItem(ID_KEY, id) : localStorage.removeItem(ID_KEY); } catch {}
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
// style 속성에 넣는 색은 HEX 형식만 허용한다.
const safeHex = (hex) => (HEX_RE.test(hex ?? '') ? hex : '#000000');
const icon = (name, cls = '') => `<span class="ms ${cls}">${name}</span>`;

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, Math.max(2800, message.length * 70));
}

// 서버가 돌려주는 원인 종류(kind)를 화면용 이름으로 바꾼다.
const KIND_LABEL = {
  DB_CONFIG_MISSING: 'DB 설정 없음',
  DB_CONFIG_INVALID: 'DB 주소 형식 오류',
  DB_AUTH: 'DB 로그인 실패',
  DB_NOT_FOUND: 'DB 이름 오류',
  DB_UNREACHABLE: 'DB 연결 실패',
  DB_SCHEMA: 'DB 테이블 구조 오류',
  DB_CONSTRAINT: 'DB 제약조건 오류',
  DB_QUERY: 'DB 처리 오류',
  WEATHER_CONFIG_MISSING: '날씨 키 없음',
  WEATHER_AUTH: '날씨 키 오류',
  WEATHER_RATE_LIMIT: '날씨 호출 한도 초과',
  WEATHER_UNAVAILABLE: '날씨 서버 오류',
  FUNCTION_FAILED: '서버 실행 실패',
  UNKNOWN: '알 수 없는 오류',
};

function errorMessage(status, data) {
  // JSON이 아닌 응답: 서버 함수가 아예 실행되지 못한 경우(Vercel 오류 페이지 등)
  if (!data && status >= 500) {
    return `[${KIND_LABEL.FUNCTION_FAILED}] 서버가 응답하지 못했습니다(HTTP ${status}). 배포 로그에서 서버 함수 오류를 확인해 주세요.`;
  }
  const message = data?.error || `요청에 실패했습니다(HTTP ${status}).`;
  return data?.kind ? `[${KIND_LABEL[data.kind] ?? data.kind}] ${message}` : message;
}

class ApiError extends Error {
  constructor(status, data) {
    super(errorMessage(status, data));
    this.status = status;
    this.data = data;
    this.kind = data?.kind ?? (!data && status >= 500 ? 'FUNCTION_FAILED' : null);
  }
}

// body: JSON으로 보낼 값, blob: 그대로 보낼 파일(사진)
async function api(path, { method = 'GET', body, blob } = {}) {
  const headers = {};
  if (blob) headers['Content-Type'] = blob.type || 'application/octet-stream';
  else if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
    method, headers, credentials: 'same-origin',
    body: blob ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  // 로그인한 상태에서 세션이 끝나면 로그인 화면으로 돌아간다.
  if (res.status === 401 && state.id) {
    signedOut();
    showGateError(data?.error || '다시 로그인해 주세요.');
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// ── 로그인 · 회원가입 ────────────────────────────────
// 서버와 같은 규칙
const ID_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/;
const ID_RULE = '아이디는 영문 소문자, 숫자, _, - 로 3~20자이며 영문이나 숫자로 시작해야 합니다.';
const PASSWORD_RULE = '비밀번호는 3~20자로 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다. (공백 제외)';
const passwordChecks = (pw) => ({
  length: /^[\x21-\x7E]{3,20}$/.test(pw),
  letter: /[A-Za-z]/.test(pw),
  digit: /\d/.test(pw),
  special: /[^A-Za-z0-9\s]/.test(pw),
});
const isValidPassword = (pw) => Object.values(passwordChecks(pw)).every(Boolean);

let authMode = 'login';

function showGateError(message) {
  const el = $('#gate-error');
  el.textContent = message;
  el.hidden = !message;
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  $$('.gate-tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
  $$('.signup-only').forEach((el) => { el.hidden = !signup; });
  $('#auth-label').textContent = signup ? '새 옷장 만들기' : '입장하기';
  $('#password-input').autocomplete = signup ? 'new-password' : 'current-password';
  showGateError('');
  updatePasswordRules();
}

function updatePasswordRules() {
  const checks = passwordChecks($('#password-input').value);
  $$('#pw-rules li').forEach((li) => li.classList.toggle('ok', checks[li.dataset.rule]));
}

function showGate() {
  $('#app').hidden = true;
  $('#gate').hidden = false;
  $('#password-input').value = '';
  $('#password-confirm').value = '';
  const last = storedId();
  if (last && !$('#closet-id-input').value) $('#closet-id-input').value = last;
}

function enterApp(id) {
  state.id = id;
  storeId(id);
  $('#closet-id').textContent = id;
  $('#gate').hidden = true;
  $('#app').hidden = false;
  showGateError('');
  // 화면을 먼저 띄우고 옷 목록은 뒤에서 불러온다. (목록을 기다리는 동안 다른 화면으로 옮겨도 되돌아가지 않게)
  show('today');
  return loadClothes().then(() => {
    if (state.view === 'closet') renderCloset();
  });
}

function signedOut() {
  state.id = null;
  state.clothes = [];
  state.loaded = false;
  showGate();
}

$$('.gate-tab').forEach((t) => t.addEventListener('click', () => setAuthMode(t.dataset.mode)));
$('#closet-id-input').addEventListener('input', () => showGateError(''));
$('#password-input').addEventListener('input', () => { showGateError(''); updatePasswordRules(); });
$('#toggle-password').addEventListener('click', () => {
  const input = $('#password-input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  $('#password-confirm').type = input.type;
  $('#toggle-password').innerHTML = icon(show ? 'visibility_off' : 'visibility');
});

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#closet-id-input').value.trim().toLowerCase();
  const password = $('#password-input').value;
  const signup = authMode === 'signup';

  if (!ID_RE.test(id)) return showGateError(signup ? ID_RULE : '아이디를 확인해 주세요.');
  if (!password) return showGateError('비밀번호를 입력해 주세요.');
  if (signup) {
    if (!isValidPassword(password)) return showGateError(PASSWORD_RULE);
    if (password !== $('#password-confirm').value) return showGateError('비밀번호 확인이 일치하지 않습니다.');
  }

  const btn = $('#auth-submit');
  btn.disabled = true;
  try {
    const result = signup
      ? await api('/api/closets', { method: 'POST', body: { id, password } })
      : await api('/api/session', { method: 'POST', body: { id, password } });
    await enterApp(result.id);
    if (signup) toast(`'${result.id}' 옷장을 만들었어요.`);
    else if (result.passwordSet) toast('비밀번호가 설정되었어요. 다음부터 이 비밀번호로 로그인하세요.');
  } catch (err) {
    showGateError(err.message);
  } finally {
    btn.disabled = false;
  }
});

$('#leave').addEventListener('click', async () => {
  if (!confirm('로그아웃할까요?')) return;
  try {
    await api('/api/session', { method: 'DELETE' });
  } catch {}
  signedOut();
});

// ── 화면 전환 ────────────────────────────────────────
function show(view) {
  state.view = view;
  $$('.view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
  const nav = view === 'form' ? 'closet' : view;
  $$('.nav-link').forEach((l) => l.classList.toggle('active', l.dataset.view === nav));
  window.scrollTo({ top: 0 });
  if (view === 'today') loadRecommendations();
  if (view === 'closet') renderCloset();
  if (view === 'saved') loadOutfits();
}

$$('.nav-link').forEach((l) => l.addEventListener('click', () => show(l.dataset.view)));
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-goto]');
  if (go?.dataset.goto === 'form') openForm();
});

// ── 공통 조각 ────────────────────────────────────────
function pieceRow(category, item) {
  return `<div class="piece">
    <span class="swatch" style="background:${safeHex(item.color_hex)}"></span>
    <div class="grow">
      <p class="piece-cat">${CATEGORY[category].label}</p>
      <p class="piece-name">${esc(item.name)}</p>
    </div>
    <span class="piece-color">${esc(item.color_name ?? colorName(item.color_hex))}</span>
  </div>`;
}

const piecesOf = (o) => PIECE_ORDER.filter((c) => o[c]).map((c) => [c, o[c]]);

// "네이비 + 베이지: 무채색 포함 (+3)" → 앞부분을 강조한다.
function reasonItem(text) {
  const i = text.indexOf(': ');
  return i < 0 ? `<li>${esc(text)}</li>` : `<li><b>${esc(text.slice(0, i))}</b>: ${esc(text.slice(i + 2))}</li>`;
}

function mainRule(reasons) {
  const tally = {};
  for (const r of reasons) {
    const m = r.match(/: (.+) \(([+-]\d+)\)$/);
    if (m) tally[m[1]] = (tally[m[1]] ?? 0) + Number(m[2]);
  }
  const [best] = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  return best && best[1] > 0 ? RULE_STYLE[best[0]] : 'Everyday Basic';
}

function harmony(score) {
  return `<span class="harmony ${score < 0 ? 'neg' : ''}">조화 ${score > 0 ? '+' : ''}${score}점</span>`;
}

// ── 오늘의 코디 ──────────────────────────────────────
const WEATHER_ICON = {
  '01d': 'wb_sunny', '01n': 'clear_night', '02d': 'partly_cloudy_day', '02n': 'partly_cloudy_night',
  '03': 'cloud', '04': 'cloud', '09': 'rainy', '10': 'rainy', '11': 'thunderstorm', '13': 'ac_unit', '50': 'foggy',
};
const weatherIcon = (code = '') => WEATHER_ICON[code] ?? WEATHER_ICON[code.slice(0, 2)] ?? 'partly_cloudy_day';

function renderDate() {
  const now = new Date();
  $('#today-weekday').textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
  $('#today-date').textContent = `${now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} · 서울`;
}

function renderWeather(w, rule) {
  const outerAdvice = { required: '아우터를 꼭 챙기세요', optional: '아우터는 선택이에요', none: '가벼운 옷차림을 추천해요' };
  $('#weather').innerHTML = `
    <div class="weather-main">
      <span class="weather-icon">${icon(weatherIcon(w.icon))}</span>
      <div>
        <p><span class="weather-temp">${esc(w.temperature)}<sup>°C</sup></span><span class="weather-city">SEOUL, KR</span></p>
        <p class="muted">${esc(w.description)}</p>
      </div>
    </div>
    <div class="weather-stats">
      <span class="stat-chip">${icon('humidity_percentage')} 습도 ${esc(w.humidity)}%</span>
      <span class="stat-chip">${icon('thermostat')} 체감 ${esc(w.feelsLike)}°C</span>
    </div>
    <p class="weather-advice">${icon('checkroom')} <span>${esc(rule.label)}<br /><span class="muted">${outerAdvice[rule.outer]}</span></span></p>`;
}

async function loadRecommendations() {
  renderDate();
  const list = $('#rec-list');
  list.innerHTML = '<div class="empty">오늘의 코디를 고르는 중…</div>';
  try {
    const data = await api('/api/recommendations');
    state.combos = data.combos;
    state.temperature = data.weather.temperature;
    renderWeather(data.weather, data.rule);
    $('#rec-rule').textContent = `오늘 기준 · ${data.rule.label}`;
    $('#rec-warnings').innerHTML = data.warnings
      .map((w) => `<p class="warning">${icon('info')} ${esc(w)}</p>`).join('');
    renderLooks();
  } catch (err) {
    if (err.status === 401) return;
    const weatherFailed = err.kind?.startsWith('WEATHER');
    $('#weather').innerHTML = `<span class="muted">${icon(weatherFailed ? 'cloud_off' : 'error')} ${
      weatherFailed ? '날씨 정보를 불러오지 못했어요.' : '서버 오류로 추천을 불러오지 못했어요.'}</span>`;
    list.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

function renderLooks() {
  const list = $('#rec-list');
  if (!state.combos.length) {
    list.innerHTML = `<div class="empty">추천할 조합이 없어요. 오늘 기온에 맞는 상의와 하의를 등록해 주세요.
      <br /><button class="btn outline" data-goto="form">${icon('add')} 옷 등록하기</button></div>`;
    return;
  }
  list.innerHTML = state.combos.map((c, i) => {
    const pieces = piecesOf(c);
    const names = [...new Set(pieces.map(([, it]) => it.color_name))].join(' · ');
    return `<article class="card look">
      <div class="look-hero">
        ${pieces.map(([, it]) => `<span class="band" style="background:${safeHex(it.color_hex)}"></span>`).join('')}
        <span class="tag">Look 0${i + 1}</span>
        ${harmony(c.score)}
        <div class="look-title">
          <p class="label-caps">${mainRule(c.reasons)}</p>
          <h3>${esc(names)}</h3>
        </div>
      </div>
      <div class="look-body">
        <div class="reason-box">${icon('palette')}
          <ul>${(c.reasons.length ? c.reasons : ['적용된 색조합 규칙이 없어요.']).map(reasonItem).join('')}</ul>
        </div>
        <div>
          <p class="pieces-head"><span class="label-caps">Wardrobe pieces</span><span class="small">${pieces.length}개 아이템</span></p>
        </div>
        <div class="pieces">${pieces.map(([cat, it]) => pieceRow(cat, it)).join('')}</div>
        <div class="look-actions">
          <button class="btn primary" data-save="${i}">${icon('bookmark_add')} 코디 저장</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

$('#refresh-rec').addEventListener('click', loadRecommendations);

$('#rec-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-save]');
  if (!btn) return;
  const c = state.combos[Number(btn.dataset.save)];
  btn.disabled = true;
  try {
    await api('/api/outfits', {
      method: 'POST',
      body: {
        top_id: c.top.id,
        bottom_id: c.bottom.id,
        outer_id: c.outer?.id ?? null,
        shoes_id: c.shoes?.id ?? null,
        temperature: state.temperature,
        reason: `색조합 ${c.score}점 · ${c.reasons.join(' / ') || '적용된 규칙 없음'}`,
      },
    });
    btn.innerHTML = `${icon('check')} 저장됨`;
    toast('코디를 저장했어요.');
  } catch (err) {
    btn.disabled = false;
    toast(err.message);
  }
});

// ── 내 옷장 ──────────────────────────────────────────
async function loadClothes() {
  const { items } = await api('/api/clothes');
  state.clothes = items;
  state.loaded = true;
  $('#item-count').textContent = `총 ${items.length}개`;
  $('#closet-count').textContent = `총 ${items.length}개 아이템`;
}

function garmentCard(c, { actions = true } = {}) {
  const t = THICK[c.thickness];
  const name = c.color_name ?? colorName(c.color_hex);
  return `<article class="card garment-card">
    <div class="garment-hero ${hexToHsl(safeHex(c.color_hex)).l > 65 ? 'light' : ''}" style="background:${safeHex(c.color_hex)}">
      ${c.photo_url
        ? `<img class="garment-photo" src="${esc(c.photo_url)}" alt="${esc(c.name)} 사진" loading="lazy" decoding="async" />`
        : icon(CATEGORY[c.category].icon, 'icon')}
      <span class="tag">${CATEGORY[c.category].en}</span>
      <div class="hero-foot">
        <span class="badge ${c.thickness === 'thick' ? 'thick' : ''}">${t.label} · ${t.range.replace(' 코디', '')}</span>
        <span class="hex">${esc(c.color_hex.toUpperCase())}</span>
      </div>
    </div>
    <div class="garment-body">
      <p class="garment-meta"><span>${CATEGORY[c.category].label}</span>
        <span><span class="swatch" style="background:${safeHex(c.color_hex)}"></span>${esc(name)}</span></p>
      <p class="garment-name">${esc(c.name) || '<span class="muted">이름 없음</span>'}</p>
      ${c.memo ? `<p class="garment-memo">${esc(c.memo)}</p>` : ''}
      ${actions ? `<div class="garment-actions">
        <button class="text-link" data-edit="${esc(c.id)}">${icon('edit')} 수정</button>
        <button class="text-link danger" data-delete="${esc(c.id)}">${icon('delete')} 삭제</button>
      </div>` : ''}
    </div>
  </article>`;
}

function renderCloset() {
  const { clothes, filter } = state;

  const count = (cat) => clothes.filter((c) => c.category === cat).length;
  $('#category-filter').innerHTML = [{ value: '', label: '전체', n: clothes.length },
    ...CATEGORIES.map((c) => ({ ...c, n: count(c.value) }))]
    .map((c) => `<button class="chip ${filter.category === c.value ? 'active' : ''}" data-value="${c.value}">${c.label}<small>${c.n}</small></button>`)
    .join('');

  const colors = new Map();
  for (const c of clothes) if (!colors.has(c.color_name)) colors.set(c.color_name, c.color_hex);
  if (filter.color && !colors.has(filter.color)) filter.color = '';
  $('#color-filter').innerHTML = `<button class="swatch-all ${filter.color ? '' : 'active'}" data-value="">전체</button>` +
    [...colors].map(([name, hex]) => `<button class="swatch-btn ${filter.color === name ? 'active' : ''}" data-value="${esc(name)}" title="${esc(name)}">
      <span class="swatch" style="background:${safeHex(hex)}"></span></button>`).join('');

  $$('#thickness-filter button').forEach((b) => b.classList.toggle('active', b.dataset.value === filter.thickness));

  const q = filter.q.trim().toLowerCase();
  const items = clothes.filter((c) =>
    (!filter.category || c.category === filter.category) &&
    (!filter.color || c.color_name === filter.color) &&
    (!filter.thickness || c.thickness === filter.thickness) &&
    (!q || `${c.name} ${c.memo ?? ''}`.toLowerCase().includes(q)));

  $('#clothes-list').innerHTML = items.length
    ? items.map((c) => garmentCard(c)).join('')
    : `<div class="empty">${clothes.length ? '조건에 맞는 옷이 없어요.' : `아직 등록한 옷이 없어요.<br /><button class="btn outline" data-goto="form">${icon('add')} 첫 옷 등록하기</button>`}</div>`;

  renderBalance();
}

function renderBalance() {
  const total = state.clothes.length;
  $('#analytics').hidden = !total;
  if (!total) return;
  const colors = { top: 'var(--rose)', bottom: 'var(--gold)', outer: 'var(--primary-border)', shoes: 'var(--good)' };
  const parts = CATEGORIES.map((c) => ({ ...c, n: state.clothes.filter((x) => x.category === c.value).length }));
  $('#balance-bar').innerHTML = parts.filter((p) => p.n)
    .map((p) => `<span style="flex:${p.n};background:${colors[p.value]}"></span>`).join('');
  $('#balance-legend').innerHTML = parts
    .map((p) => `<span><i style="background:${colors[p.value]}"></i>${p.label} ${Math.round((p.n / total) * 100)}% (${p.n})</span>`).join('');
}

$('#category-filter').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.filter.category = chip.dataset.value;
  renderCloset();
});
$('#color-filter').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-value]');
  if (!btn) return;
  state.filter.color = btn.dataset.value;
  renderCloset();
});
$('#thickness-filter').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  state.filter.thickness = btn.dataset.value;
  renderCloset();
});
$('#search').addEventListener('input', (e) => {
  state.filter.q = e.target.value;
  renderCloset();
});

$('#clothes-list').addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-edit]');
  const delBtn = e.target.closest('[data-delete]');
  if (editBtn) {
    const item = state.clothes.find((x) => String(x.id) === editBtn.dataset.edit);
    if (item) openForm(item);
  }
  if (delBtn) await deleteCloth(delBtn.dataset.delete);
});

async function deleteCloth(rawId) {
  const id = encodeURIComponent(rawId);
  if (!confirm('이 옷을 삭제할까요?')) return;
  try {
    await api(`/api/clothes/${id}`, { method: 'DELETE' });
  } catch (err) {
    if (err.status !== 409) return toast(err.message);
    if (!confirm(`${err.message}\n그 코디도 함께 삭제할까요?`)) return;
    try {
      await api(`/api/clothes/${id}?force=1`, { method: 'DELETE' });
    } catch (err2) {
      return toast(err2.message);
    }
  }
  toast('삭제했어요.');
  await loadClothes();
  renderCloset();
}

// ── 옷 등록 / 수정 ───────────────────────────────────
$('#category-tiles').innerHTML = CATEGORIES.map((c) =>
  `<button type="button" class="tile" data-value="${c.value}">${icon(c.icon)}<span>${c.label} (${c.en})</span></button>`).join('');
$('#thickness-tiles').innerHTML = THICKNESS.map((t) =>
  `<button type="button" class="tile left" data-value="${t.value}">${icon(t.icon)}<strong>${t.label}</strong>
    <span>${t.season}</span><span class="small">${t.range}</span></button>`).join('');
$('#preset-swatches').innerHTML = PRESETS.map(([name, hex]) =>
  `<button type="button" class="preset" data-hex="${hex}"><span class="swatch" style="background:${hex}"></span>${name}</button>`).join('');

function openForm(item = null) {
  releasePhotoPreview();
  $('#cloth-form').reset();
  $('#cloth-id').value = item?.id ?? '';
  $('#cloth-name').value = item?.name ?? '';
  $('#cloth-memo').value = item?.memo ?? '';
  state.form = {
    category: item?.category ?? 'top',
    thickness: item?.thickness ?? 'medium',
    color: (item?.color_hex ?? '#1F2A44').toUpperCase(),
    // 사진: keep(기존 유지) | new(새로 고름) | remove(삭제)
    photo: { mode: 'keep', url: item?.photo_url ?? null, blob: null },
  };
  $('#photo-input').value = '';
  $('#form-title').textContent = item ? '옷 정보 수정하기' : '새 옷 등록하기';
  $('#form-eyebrow').textContent = item ? 'EDIT ITEM' : 'NEW ITEM REGISTRATION';
  $('#submit-label').textContent = item ? '변경 내용 저장' : '아이템 저장하기';
  show('form');
  syncForm();
}

function syncForm() {
  const { category, thickness, color } = state.form;
  const name = colorName(color);
  $$('#category-tiles .tile').forEach((t) => t.classList.toggle('active', t.dataset.value === category));
  $$('#thickness-tiles .tile').forEach((t) => t.classList.toggle('active', t.dataset.value === thickness));
  $$('#preset-swatches .preset').forEach((p) => p.classList.toggle('active', p.dataset.hex === color));
  $('#cloth-color').value = color.toLowerCase();
  $('#color-big').style.background = safeHex(color);
  $('#color-hex').textContent = color;
  $('#color-name').textContent = name;
  $('#color-name-en').textContent = COLOR_EN[name] ?? '';
  $('#name-count').textContent = `${$('#cloth-name').value.length} / 100`;
  $('#memo-count').textContent = `${$('#cloth-memo').value.length} / 500`;

  const { photo } = state.form;
  const preview = {
    id: '', name: $('#cloth-name').value.trim(), memo: $('#cloth-memo').value.trim(),
    category, thickness, color_hex: color, color_name: name,
    photo_url: photo.mode === 'remove' ? null : photo.url,
  };
  const hasPhoto = Boolean(preview.photo_url);
  $('#photo-drop').hidden = hasPhoto;
  $('#photo-actions').hidden = !hasPhoto;
  $('#preview-card').outerHTML = garmentCard(preview, { actions: false }).replace('<article class="card garment-card">', '<article class="garment-card" id="preview-card">');
  $('#preview-rule').textContent = `${THICK[thickness].label} · ${THICK[thickness].range}에 추천돼요`;
}

$('#category-tiles').addEventListener('click', (e) => {
  const t = e.target.closest('.tile');
  if (t) { state.form.category = t.dataset.value; syncForm(); }
});
$('#thickness-tiles').addEventListener('click', (e) => {
  const t = e.target.closest('.tile');
  if (t) { state.form.thickness = t.dataset.value; syncForm(); }
});
$('#preset-swatches').addEventListener('click', (e) => {
  const p = e.target.closest('.preset');
  if (p) { state.form.color = p.dataset.hex; syncForm(); }
});
$('#cloth-color').addEventListener('input', (e) => {
  state.form.color = e.target.value.toUpperCase();
  syncForm();
});
// ── 사진 고르기 (클릭/탭, 드래그 앤 드롭) ──
function releasePhotoPreview() {
  const { photo } = state.form;
  if (photo?.mode === 'new' && photo.url) URL.revokeObjectURL(photo.url);
}

async function choosePhoto(file) {
  if (!file) return;
  const drop = $('#photo-drop');
  drop.classList.add('busy');
  $('#photo-drop-title').textContent = '사진을 준비하는 중…';
  try {
    const blob = await preparePhoto(file);
    releasePhotoPreview();
    state.form.photo = { mode: 'new', url: URL.createObjectURL(blob), blob };
    syncForm();
  } catch (err) {
    toast(err instanceof PhotoError ? err.message : '사진을 불러오지 못했어요. 다른 사진으로 시도해 주세요.');
  } finally {
    drop.classList.remove('busy');
    $('#photo-drop-title').textContent = '사진을 끌어다 놓거나 눌러서 선택';
    $('#photo-input').value = ''; // 같은 파일을 다시 골라도 change가 일어나게
  }
}

$('#photo-input').addEventListener('change', (e) => choosePhoto(e.target.files?.[0]));
$('#photo-remove').addEventListener('click', () => {
  releasePhotoPreview();
  state.form.photo = { mode: 'remove', url: null, blob: null };
  syncForm();
});
const drop = $('#photo-drop');
['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (e) => {
  e.preventDefault();
  drop.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((type) => drop.addEventListener(type, () => drop.classList.remove('dragging')));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  choosePhoto(e.dataTransfer?.files?.[0]);
});
// 사진을 놓을 곳을 조금 벗어나 떨어뜨려도 브라우저가 파일을 열어 버리지 않게 한다.
['dragover', 'drop'].forEach((type) => window.addEventListener(type, (e) => {
  if (state.view === 'form' && e.dataTransfer?.types?.includes('Files')) e.preventDefault();
}));

$('#cloth-name').addEventListener('input', syncForm);
$('#cloth-memo').addEventListener('input', syncForm);
$('#cancel-form').addEventListener('click', () => {
  releasePhotoPreview();
  show('closet');
});

$('#cloth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#cloth-id').value;
  const body = {
    name: $('#cloth-name').value,
    category: state.form.category,
    thickness: state.form.thickness,
    color_hex: state.form.color,
    memo: $('#cloth-memo').value,
  };
  if (!body.name.trim()) {
    $('#cloth-name').focus();
    return toast('아이템 이름을 입력해 주세요.');
  }
  const btn = $('#submit-cloth');
  btn.disabled = true;
  $('#submit-label').textContent = '저장하는 중…';
  let saved;
  try {
    saved = id
      ? await api(`/api/clothes/${encodeURIComponent(id)}`, { method: 'PUT', body })
      : await api('/api/clothes', { method: 'POST', body });
  } catch (err) {
    btn.disabled = false;
    $('#submit-label').textContent = id ? '변경 내용 저장' : '아이템 저장하기';
    return toast(err.message);
  }

  // 옷 정보가 저장된 다음 사진을 올리거나 지운다.
  const { photo } = state.form;
  const photoPath = `/api/clothes/${encodeURIComponent(saved.id)}/photo`;
  let message = id ? '수정했어요.' : '옷장에 등록했어요.';
  try {
    if (photo.mode === 'new') await api(photoPath, { method: 'PUT', blob: photo.blob });
    if (photo.mode === 'remove' && id) await api(photoPath, { method: 'DELETE' });
  } catch (err) {
    message = `옷 정보는 저장됐지만 사진을 저장하지 못했어요. ${err.message}`;
  }
  releasePhotoPreview();
  btn.disabled = false;
  toast(message);
  await loadClothes();
  show('closet');
});

// ── 저장한 코디 ──────────────────────────────────────
async function loadOutfits() {
  const list = $('#saved-list');
  list.innerHTML = '<div class="empty">불러오는 중…</div>';
  try {
    const outfits = await api('/api/outfits');
    $('#saved-count').textContent = outfits.length;
    if (!outfits.length) {
      list.innerHTML = '<div class="empty">저장한 코디가 없어요. 오늘의 코디에서 마음에 드는 룩을 저장해 보세요.</div>';
      return;
    }
    list.innerHTML = outfits.map((o, i) => {
      const pieces = piecesOf(o);
      // reason 형식: "색조합 N점 · 규칙1 / 규칙2"
      const m = (o.reason ?? '').match(/^색조합 (-?\d+)점 · (.*)$/s);
      const reasons = (m ? m[2] : o.reason ?? '').split(' / ').filter(Boolean);
      const date = new Date(o.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
      return `<article class="card saved">
        <div class="saved-hero">
          ${pieces.map(([, it]) => `<span style="background:${safeHex(it.color_hex)}"></span>`).join('')}
          <span class="tag">Look #${String(outfits.length - i).padStart(2, '0')}</span>
        </div>
        <div class="saved-body">
          <div class="saved-top">
            <p class="saved-date">${esc(date)} 저장 <span class="dot"></span> ${icon('thermostat')} ${esc(Number(o.temperature))}°C 서울</p>
            <div class="saved-top-right">
              ${m ? harmony(Number(m[1])) : ''}
              <button class="icon-btn danger" data-remove="${esc(o.id)}" title="삭제">${icon('delete_outline')}</button>
            </div>
          </div>
          <div class="pieces">${pieces.length ? pieces.map(([cat, it]) => pieceRow(cat, it)).join('') : '<p class="muted">삭제된 옷으로 구성된 코디예요.</p>'}</div>
          ${reasons.length ? `<div class="reason-box">${icon('palette')}<ul>${reasons.map(reasonItem).join('')}</ul></div>` : ''}
        </div>
      </article>`;
    }).join('');
  } catch (err) {
    if (err.status !== 401) list.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

$('#saved-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn || !confirm('이 코디를 삭제할까요?')) return;
  try {
    await api(`/api/outfits/${encodeURIComponent(btn.dataset.remove)}`, { method: 'DELETE' });
    toast('삭제했어요.');
    loadOutfits();
  } catch (err) {
    toast(err.message);
  }
});

// ── 시작 ─────────────────────────────────────────────
// 세션 쿠키가 살아 있으면 바로 들어가고, 아니면 로그인 화면을 보여 준다.
(async () => {
  setAuthMode('login');
  try {
    const me = await api('/api/closets/me');
    await enterApp(me.id);
  } catch (err) {
    showGate();
    if (err.status !== 401) showGateError(err.message);
  }
})();
