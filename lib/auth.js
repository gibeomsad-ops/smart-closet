import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

// ── 아이디 · 비밀번호 규칙 ───────────────────────────
// 아이디: 영문 소문자·숫자·_·- 3~20자, 첫 글자는 영문/숫자. 대소문자 구분 없음(소문자로 저장).
export const ID_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/;
export const ID_RULE = '아이디는 영문 소문자, 숫자, _, - 로 3~20자이며 영문이나 숫자로 시작해야 합니다.';

// 비밀번호: 3~20자, 영문·숫자·특수문자(공백 제외)만 사용, 영문·숫자·특수문자를 각각 1개 이상 포함.
// 영문 대소문자를 구분한다.
export const PASSWORD_RULE = '비밀번호는 3~20자로 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다. (공백 제외)';
export function isValidPassword(pw) {
  return typeof pw === 'string' && /^[\x21-\x7E]{3,20}$/.test(pw) &&
    /[A-Za-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

// ── 비밀번호 해시 (scrypt) ───────────────────────────
// 저장 형식: scrypt$<salt base64>$<hash base64>
const KEY_LEN = 32;

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pw, salt, KEY_LEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(pw, stored) {
  const [scheme, saltB64, hashB64] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(String(pw), Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ── 세션 토큰 (HMAC 서명, HttpOnly 쿠키) ──────────────
export const SESSION_COOKIE = 'closet_session';
const SESSION_DAYS = 30;

// SESSION_SECRET이 없으면 DATABASE_URL에서 키를 만든다. (둘 다 서버에만 있는 비밀)
function sessionKey() {
  const secret = process.env.SESSION_SECRET?.trim() || process.env.DATABASE_URL?.trim();
  if (!secret) return null;
  return crypto.createHmac('sha256', 'smart-closet-session').update(secret).digest();
}

const sign = (data, key) => crypto.createHmac('sha256', key).update(data).digest('base64url');

// pv: 비밀번호 해시의 일부. 비밀번호가 바뀌면 예전 세션은 무효가 된다.
const passwordVersion = (passwordHash) =>
  crypto.createHash('sha256').update(String(passwordHash ?? '')).digest('base64url').slice(0, 12);

export function createSessionToken(closet) {
  const key = sessionKey();
  const payload = Buffer.from(JSON.stringify({
    cid: String(closet.id),
    pv: passwordVersion(closet.password_hash),
    exp: Date.now() + SESSION_DAYS * 86400_000,
  })).toString('base64url');
  return `${payload}.${sign(payload, key)}`;
}

// 서명과 만료를 확인하고 { cid, pv }를 돌려준다. 잘못된 토큰이면 null.
export function readSessionToken(token) {
  const key = sessionKey();
  const [payload, sig] = String(token ?? '').split('.');
  if (!key || !payload || !sig) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function sessionMatches(session, closet) {
  return session.cid === String(closet.id) && session.pv === passwordVersion(closet.password_hash);
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token, { secure }) {
  const attrs = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_DAYS * 86400}`];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearSessionCookie({ secure }) {
  return [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', ...(secure ? ['Secure'] : [])].join('; ');
}

