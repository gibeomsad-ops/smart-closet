import crypto from 'node:crypto';
import express from 'express';
import { db } from './db.js';
import { HEX_RE, colorName } from './color.js';
import { recommend } from './recommend.js';
import { getSeoulWeather } from './weather.js';

const CATEGORIES = ['top', 'bottom', 'outer', 'shoes'];
const THICKNESS = ['thin', 'medium', 'thick'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O, 1/I 제외
const CODE_LENGTH = 10;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function generateCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function normalizeCode(raw) {
  return String(raw ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
}

function toClothing(row) {
  return { ...row, color_name: colorName(row.color_hex) };
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

// 요청 헤더의 옷장 코드를 확인하고 req.closet에 옷장을 담는다.
const requireCloset = wrap(async (req, res, next) => {
  const code = normalizeCode(req.get('x-closet-code'));
  if (!CODE_RE.test(code)) throw new HttpError(401, '옷장 코드가 필요합니다.');
  const [closet] = await db()`SELECT id, code, created_at FROM closets WHERE code = ${code}`;
  if (!closet) throw new HttpError(401, '존재하지 않는 옷장 코드입니다.');
  req.closet = closet;
  next();
});

async function listClothes(closetId) {
  const rows = await db()`
    SELECT id, name, category, color_hex, thickness, memo, created_at
    FROM clothes WHERE closet_id = ${closetId}
    ORDER BY created_at DESC, id DESC`;
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
app.post('/api/closets', wrap(async (req, res) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const [exists] = await db()`SELECT 1 FROM closets WHERE code = ${code}`;
    if (exists) continue;
    const [closet] = await db()`INSERT INTO closets (code) VALUES (${code}) RETURNING code, created_at`;
    return res.status(201).json(closet);
  }
  throw new HttpError(500, '옷장 코드를 만들지 못했습니다. 다시 시도해 주세요.');
}));

app.get('/api/closets/me', requireCloset, (req, res) => {
  res.json({ code: req.closet.code, created_at: req.closet.created_at });
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
      SELECT id, top_id, bottom_id, outer_id, shoes_id, temperature, reason, created_at
      FROM outfits WHERE closet_id = ${req.closet.id}
      ORDER BY created_at DESC, id DESC`,
    listClothes(req.closet.id),
  ]);
  const byId = new Map(clothes.map((c) => [String(c.id), c]));
  const find = (id) => (id == null ? null : byId.get(String(id)) ?? null);
  res.json(outfits.map((o) => ({
    id: o.id,
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

app.delete('/api/outfits/:id', requireCloset, wrap(async (req, res) => {
  const rows = await db()`
    DELETE FROM outfits WHERE id = ${req.params.id} AND closet_id = ${req.closet.id} RETURNING id`;
  if (!rows.length) throw new HttpError(404, '코디를 찾을 수 없습니다.');
  res.status(204).end();
}));

app.use('/api', (req, res) => res.status(404).json({ error: '없는 API입니다.' }));

// 내부 오류 내용(접속 정보 등)은 응답에 담지 않고 서버 로그에만 남긴다.
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: '잘못된 요청 형식입니다.' });
  if (err?.code === '22P02') return res.status(404).json({ error: '항목을 찾을 수 없습니다.' }); // 잘못된 id 형식
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

export default app;
