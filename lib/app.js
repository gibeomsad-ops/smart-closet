import express from 'express';
import { db } from './db.js';
import { HEX_RE, colorName } from './color.js';
import { recommend } from './recommend.js';
import { getSeoulWeather } from './weather.js';
import { ServiceError, newErrorId } from './errors.js';
import {
  ID_RE, ID_RULE, PASSWORD_RULE, SESSION_COOKIE, isValidPassword, hashPassword, verifyPassword,
  createSessionToken, readSessionToken, sessionMatches, parseCookies, sessionCookie, clearSessionCookie,
} from './auth.js';

const CATEGORIES = ['top', 'bottom', 'outer', 'shoes'];
const THICKNESS = ['thin', 'medium', 'thick'];
// 아이디는 closets.code 컬럼에, 비밀번호 해시는 closets.password_hash 컬럼에 저장한다.
// (예전 무작위 코드도 아이디 규칙에 맞아 그대로 쓸 수 있다)
const ID_TAKEN = '이 아이디는 사용할 수 없습니다';
const LOGIN_FAILED = '아이디 또는 비밀번호가 올바르지 않습니다.';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function normalizeId(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

async function findCloset(id) {
  const [closet] = await db()`SELECT id, code, password_hash, created_at FROM closets WHERE lower(code) = ${id}`;
  return closet;
}

const isHttps = (req) => req.secure || req.get('x-forwarded-proto') === 'https';

function startSession(req, res, closet) {
  res.set('Set-Cookie', sessionCookie(createSessionToken(closet), { secure: isHttps(req) }));
}

function toClothing({ photo_version, ...row }) {
  return {
    ...row,
    color_name: colorName(row.color_hex),
    // 사진이 바뀌면 주소(v)가 바뀌므로 브라우저가 오래 캐시해도 된다.
    photo_url: photo_version ? `/api/clothes/${row.id}/photo?v=${photo_version}` : null,
  };
}

// 사진 형식은 확장자나 Content-Type이 아니라 파일 앞부분(매직 바이트)으로 판별한다.
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
function detectImageType(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function parseClothing(body) {
  const name = String(body?.name ?? '').trim();
  const category = body?.category;
  const color_hex = String(body?.color_hex ?? '').toUpperCase();
  const thickness = body?.thickness;
  const memo = String(body?.memo ?? '').trim();

  if (!name || name.length > 100) throw new HttpError(400, '이름은 1~100자로 입력해 주세요.');
  if (!CATEGORIES.includes(category)) throw new HttpError(400, '종류가 올바르지 않습니다.');
  if (!HEX_RE.test(color_hex)) throw new HttpError(400, '색상은 #RRGGBB 형식이어야 합니다.');
  if (!THICKNESS.includes(thickness)) throw new HttpError(400, '두께가 올바르지 않습니다.');
  if (memo.length > 500) throw new HttpError(400, '메모는 500자 이내로 입력해 주세요.');
  return { name, category, color_hex, thickness, memo: memo || null };
}

// 세션 쿠키를 확인하고 req.closet에 로그인한 옷장을 담는다.
const requireCloset = wrap(async (req, res, next) => {
  const session = readSessionToken(parseCookies(req.get('cookie'))[SESSION_COOKIE]);
  if (!session) throw new HttpError(401, '로그인이 필요합니다.');
  const [closet] = await db()`SELECT id, code, password_hash, created_at FROM closets WHERE id = ${session.cid}`;
  if (!closet || !sessionMatches(session, closet)) {
    throw new HttpError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.');
  }
  req.closet = closet;
  next();
});

async function listClothes(closetId) {
  const rows = await db()`
    SELECT c.id, c.name, c.category, c.color_hex, c.thickness, c.memo, c.created_at,
      floor(extract(epoch FROM p.updated_at) * 1000)::bigint::text AS photo_version
    FROM clothes c LEFT JOIN clothing_photos p ON p.clothing_id = c.id
    WHERE c.closet_id = ${closetId}
    ORDER BY c.created_at DESC, c.id DESC`;
  return rows.map(toClothing);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ── 옷장 ─────────────────────────────────────────────
// 회원가입: 새 옷장 만들기
app.post('/api/closets', wrap(async (req, res) => {
  const id = normalizeId(req.body?.id);
  const password = req.body?.password;
  if (!ID_RE.test(id)) throw new HttpError(400, ID_RULE);
  if (!isValidPassword(password)) throw new HttpError(400, PASSWORD_RULE);
  if (await findCloset(id)) throw new HttpError(409, ID_TAKEN);

  const passwordHash = await hashPassword(password);
  let closet;
  try {
    [closet] = await db()`
      INSERT INTO closets (code, password_hash) VALUES (${id}, ${passwordHash})
      RETURNING id, code, password_hash, created_at`;
  } catch (err) {
    // 동시에 같은 아이디로 가입한 경우 (code 컬럼의 UNIQUE 제약)
    if (err?.cause?.code === '23505') throw new HttpError(409, ID_TAKEN);
    throw err;
  }
  startSession(req, res, closet);
  res.status(201).json({ id: closet.code });
}));

// 로그인
app.post('/api/session', wrap(async (req, res) => {
  const id = normalizeId(req.body?.id);
  const password = String(req.body?.password ?? '');
  if (!ID_RE.test(id) || !password) throw new HttpError(401, LOGIN_FAILED);

  const closet = await findCloset(id);
  if (!closet) throw new HttpError(401, LOGIN_FAILED);

  let passwordSet = false;
  if (!closet.password_hash) {
    // 비밀번호 기능 이전에 만든 옷장: 무작위 코드를 아는 사람이 주인이므로 이번에 입력한 비밀번호로 설정한다.
    if (!isValidPassword(password)) throw new HttpError(400, `이 옷장은 아직 비밀번호가 없습니다. 사용할 비밀번호를 입력해 주세요. ${PASSWORD_RULE}`);
    closet.password_hash = await hashPassword(password);
    await db()`UPDATE closets SET password_hash = ${closet.password_hash} WHERE id = ${closet.id}`;
    passwordSet = true;
  } else if (!(await verifyPassword(password, closet.password_hash))) {
    throw new HttpError(401, LOGIN_FAILED);
  }

  startSession(req, res, closet);
  res.json({ id: closet.code, passwordSet });
}));

// 로그아웃
app.delete('/api/session', (req, res) => {
  res.set('Set-Cookie', clearSessionCookie({ secure: isHttps(req) }));
  res.status(204).end();
});

app.get('/api/closets/me', requireCloset, (req, res) => {
  res.json({ id: req.closet.code, created_at: req.closet.created_at });
});

// ── 옷 ───────────────────────────────────────────────
app.get('/api/clothes', requireCloset, wrap(async (req, res) => {
  const all = await listClothes(req.closet.id);
  const { category, color } = req.query;
  const items = all.filter((c) =>
    (!category || c.category === category) && (!color || c.color_name === color));
  const colors = [...new Set(all.map((c) => c.color_name))].sort();
  res.json({ items, colors });
}));

app.post('/api/clothes', requireCloset, wrap(async (req, res) => {
  const c = parseClothing(req.body);
  const [row] = await db()`
    INSERT INTO clothes (closet_id, name, category, color_hex, thickness, memo)
    VALUES (${req.closet.id}, ${c.name}, ${c.category}, ${c.color_hex}, ${c.thickness}, ${c.memo})
    RETURNING id, name, category, color_hex, thickness, memo, created_at`;
  res.status(201).json(toClothing(row));
}));

app.put('/api/clothes/:id', requireCloset, wrap(async (req, res) => {
  const c = parseClothing(req.body);
  const [row] = await db()`
    UPDATE clothes SET name = ${c.name}, category = ${c.category}, color_hex = ${c.color_hex},
      thickness = ${c.thickness}, memo = ${c.memo}
    WHERE id = ${req.params.id} AND closet_id = ${req.closet.id}
    RETURNING id, name, category, color_hex, thickness, memo, created_at`;
  if (!row) throw new HttpError(404, '옷을 찾을 수 없습니다.');
  res.json(toClothing(row));
}));

app.delete('/api/clothes/:id', requireCloset, wrap(async (req, res) => {
  const id = req.params.id;
  const closetId = req.closet.id;
  const [item] = await db()`SELECT id FROM clothes WHERE id = ${id} AND closet_id = ${closetId}`;
  if (!item) throw new HttpError(404, '옷을 찾을 수 없습니다.');

  // 저장된 코디에서 쓰이는 옷이면, force=1 일 때만 그 코디까지 함께 지운다.
  const [{ count }] = await db()`
    SELECT COUNT(*)::int AS count FROM outfits
    WHERE closet_id = ${closetId}
      AND (top_id = ${id} OR bottom_id = ${id} OR outer_id = ${id} OR shoes_id = ${id})`;
  if (count > 0 && req.query.force !== '1') {
    return res.status(409).json({ error: `저장된 코디 ${count}개에서 사용 중인 옷입니다.`, outfitCount: count });
  }
  if (count > 0) {
    await db()`
      DELETE FROM outfits WHERE closet_id = ${closetId}
        AND (top_id = ${id} OR bottom_id = ${id} OR outer_id = ${id} OR shoes_id = ${id})`;
  }
  await db()`DELETE FROM clothes WHERE id = ${id} AND closet_id = ${closetId}`;
  res.status(204).end();
}));

// ── 옷 사진 ──────────────────────────────────────────
// 브라우저가 줄여서 보낸 이미지 바이트를 그대로 받는다. (Vercel 요청 크기 제한 4.5MB)
const photoBody = express.raw({ type: () => true, limit: MAX_PHOTO_BYTES });

async function requireOwnClothing(req) {
  const [item] = await db()`SELECT id FROM clothes WHERE id = ${req.params.id} AND closet_id = ${req.closet.id}`;
  if (!item) throw new HttpError(404, '옷을 찾을 수 없습니다.');
  return item;
}

app.put('/api/clothes/:id/photo', requireCloset, (req, res, next) => {
  photoBody(req, res, (err) => {
    if (err?.type === 'entity.too.large') return next(new HttpError(413, '사진이 너무 큽니다. 3MB 이하로 올려 주세요.'));
    next(err);
  });
}, wrap(async (req, res) => {
  const item = await requireOwnClothing(req);
  const data = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const mime = detectImageType(data);
  if (!mime) throw new HttpError(415, 'JPG, PNG, WebP 사진만 올릴 수 있습니다.');
  const [row] = await db()`
    INSERT INTO clothing_photos (clothing_id, mime, data, updated_at)
    VALUES (${item.id}, ${mime}, ${data}, now())
    ON CONFLICT (clothing_id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = now()
    RETURNING floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS v`;
  res.json({ photo_url: `/api/clothes/${item.id}/photo?v=${row.v}` });
}));

app.get('/api/clothes/:id/photo', requireCloset, wrap(async (req, res) => {
  const [photo] = await db()`
    SELECT p.mime, p.data FROM clothing_photos p JOIN clothes c ON c.id = p.clothing_id
    WHERE c.id = ${req.params.id} AND c.closet_id = ${req.closet.id}`;
  if (!photo) throw new HttpError(404, '사진이 없습니다.');
  res.set({
    'Content-Type': photo.mime,
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(photo.data);
}));

app.delete('/api/clothes/:id/photo', requireCloset, wrap(async (req, res) => {
  const item = await requireOwnClothing(req);
  await db()`DELETE FROM clothing_photos WHERE clothing_id = ${item.id}`;
  res.status(204).end();
}));

// ── 날씨 · 추천 ──────────────────────────────────────
app.get('/api/weather', requireCloset, wrap(async (req, res) => {
  res.json(await getSeoulWeather());
}));

app.get('/api/recommendations', requireCloset, wrap(async (req, res) => {
  const [weather, clothes] = await Promise.all([getSeoulWeather(), listClothes(req.closet.id)]);
  res.json({ weather, ...recommend(clothes, weather.temperature) });
}));

// ── 저장한 코디 ──────────────────────────────────────
app.get('/api/outfits', requireCloset, wrap(async (req, res) => {
  const [outfits, clothes] = await Promise.all([
    db()`
      SELECT id, name, top_id, bottom_id, outer_id, shoes_id, temperature, reason, created_at
      FROM outfits WHERE closet_id = ${req.closet.id}
      ORDER BY created_at DESC, id DESC`,
    listClothes(req.closet.id),
  ]);
  const byId = new Map(clothes.map((c) => [String(c.id), c]));
  const find = (id) => (id == null ? null : byId.get(String(id)) ?? null);
  res.json(outfits.map((o) => ({
    id: o.id,
    name: o.name,
    temperature: o.temperature,
    reason: o.reason,
    created_at: o.created_at,
    top: find(o.top_id),
    bottom: find(o.bottom_id),
    outer: find(o.outer_id),
    shoes: find(o.shoes_id),
  })));
}));

app.post('/api/outfits', requireCloset, wrap(async (req, res) => {
  const { top_id, bottom_id, outer_id = null, shoes_id = null, temperature, reason } = req.body ?? {};
  if (top_id == null || bottom_id == null) throw new HttpError(400, '상의와 하의는 필수입니다.');
  const temp = Number(temperature);
  if (!Number.isFinite(temp) || temp < -60 || temp > 60) throw new HttpError(400, '기온 값이 올바르지 않습니다.');
  const reasonText = String(reason ?? '').slice(0, 1000);

  // 모든 옷이 내 옷장의 옷이고 종류가 맞는지 확인한다.
  const expected = { top: top_id, bottom: bottom_id, outer: outer_id, shoes: shoes_id };
  const mine = new Map((await listClothes(req.closet.id)).map((c) => [String(c.id), c]));
  for (const [category, id] of Object.entries(expected)) {
    if (id == null) continue;
    if (mine.get(String(id))?.category !== category) throw new HttpError(400, '옷 정보가 올바르지 않습니다.');
  }

  const [row] = await db()`
    INSERT INTO outfits (closet_id, top_id, bottom_id, outer_id, shoes_id, temperature, reason)
    VALUES (${req.closet.id}, ${top_id}, ${bottom_id}, ${outer_id}, ${shoes_id}, ${temp}, ${reasonText})
    RETURNING id, created_at`;
  res.status(201).json(row);
}));

// 코디 이름 짓기 · 바꾸기. 빈 이름이면 이름을 지운다.
const OUTFIT_NAME_MAX = 40;
app.patch('/api/outfits/:id', requireCloset, wrap(async (req, res) => {
  if (typeof req.body?.name !== 'string' && req.body?.name !== null) throw new HttpError(400, '코디 이름이 올바르지 않습니다.');
  // 줄바꿈·탭 등은 공백 하나로, 그 밖의 제어문자는 지운다.
  const name = String(req.body.name ?? '').replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if ([...name].length > OUTFIT_NAME_MAX) throw new HttpError(400, `코디 이름은 ${OUTFIT_NAME_MAX}자 이내로 지어 주세요.`);
  const [row] = await db()`
    UPDATE outfits SET name = ${name || null}
    WHERE id = ${req.params.id} AND closet_id = ${req.closet.id} RETURNING id, name`;
  if (!row) throw new HttpError(404, '코디를 찾을 수 없습니다.');
  res.json(row);
}));

app.delete('/api/outfits/:id', requireCloset, wrap(async (req, res) => {
  const rows = await db()`
    DELETE FROM outfits WHERE id = ${req.params.id} AND closet_id = ${req.closet.id} RETURNING id`;
  if (!rows.length) throw new HttpError(404, '코디를 찾을 수 없습니다.');
  res.status(204).end();
}));

app.use('/api', (req, res) => res.status(404).json({ error: '없는 API입니다.' }));

// 응답에는 원인 종류(kind)와 안내 문구만 담는다. 원본 오류(접속 정보가 섞일 수 있음)는
// 서버 로그에만 남기고, 로그에서 찾을 수 있도록 오류 ID를 함께 돌려준다.
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: '잘못된 요청 형식입니다.' });
  if (err?.code === '22P02') return res.status(404).json({ error: '항목을 찾을 수 없습니다.' }); // 잘못된 id 형식

  const errorId = newErrorId();
  if (err instanceof ServiceError) {
    console.error(`[${errorId}] ${err.kind}: ${err.message}`, err.cause ?? '');
    return res.status(err.status).json({ error: err.message, kind: err.kind, errorId });
  }
  console.error(`[${errorId}] UNKNOWN`, err);
  res.status(500).json({
    error: `알 수 없는 서버 오류가 발생했습니다. 서버 로그에서 오류 ID ${errorId}를 찾아 확인해 주세요.`,
    kind: 'UNKNOWN',
    errorId,
  });
});

export default app;
