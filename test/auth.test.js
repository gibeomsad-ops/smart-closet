import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidPassword, hashPassword, verifyPassword, createSessionToken, readSessionToken, sessionMatches, parseCookies,
} from '../lib/auth.js';

test('비밀번호 규칙: 3~20자, 영문·숫자·특수문자 각 1개 이상', () => {
  for (const ok of ['a1!', 'Abc123!@', 'P@ssw0rd', 'x9#'.padEnd(20, 'y')]) assert.ok(isValidPassword(ok), ok);
  for (const bad of ['a1', 'abc!', '123!', 'abc123', 'a1! b', 'a1!'.padEnd(21, 'z'), '비번1!', '', undefined]) {
    assert.ok(!isValidPassword(bad), String(bad));
  }
});

test('비밀번호 해시: 평문 저장 안 함, 대소문자 구분', async () => {
  const hash = await hashPassword('Abc1!');
  assert.ok(!hash.includes('Abc1!'));
  assert.ok(await verifyPassword('Abc1!', hash));
  assert.ok(!(await verifyPassword('abc1!', hash)));
  assert.ok(!(await verifyPassword('Abc1!', 'garbage')));
  assert.notEqual(hash, await hashPassword('Abc1!')); // 솔트가 매번 다름
});

test('세션 토큰: 서명 위조·비밀번호 변경 시 무효', () => {
  process.env.SESSION_SECRET = 'test-secret';
  const closet = { id: 7, password_hash: 'scrypt$a$b' };
  const token = createSessionToken(closet);
  const session = readSessionToken(token);
  assert.ok(session && sessionMatches(session, closet));

  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), cid: '8' })).toString('base64url');
  assert.equal(readSessionToken(`${forged}.${sig}`), null);
  assert.equal(readSessionToken('nonsense'), null);
  assert.ok(!sessionMatches(session, { ...closet, password_hash: 'scrypt$c$d' }));
  assert.equal(parseCookies('a=1; closet_session=x.y').closet_session, 'x.y');
});
