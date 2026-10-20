import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDbError } from '../lib/errors.js';

const kind = (err) => classifyDbError(err)?.kind ?? null;

test('DB 오류 원인 분류', () => {
  assert.equal(kind({ code: '28P01', message: 'password authentication failed' }), 'DB_AUTH');
  assert.equal(kind({ message: "password authentication failed for user 'neondb_owner'" }), 'DB_AUTH');
  assert.equal(kind({ code: '3D000', message: 'database "x" does not exist' }), 'DB_NOT_FOUND');
  assert.equal(kind({ message: 'Error connecting to database: TypeError: fetch failed', sourceError: { cause: { code: 'ENOTFOUND' } } }), 'DB_UNREACHABLE');
  assert.equal(kind({ code: '23503', message: 'violates foreign key constraint' }), 'DB_CONSTRAINT');
  assert.equal(kind({ code: '22P02', message: 'invalid input syntax' }), null);
  assert.equal(kind(new Error('something else')), null);
});

test('테이블·컬럼 이름은 안내에 포함', () => {
  const e = classifyDbError({ code: '42P01', message: 'relation "closets" does not exist' });
  assert.equal(e.kind, 'DB_SCHEMA');
  assert.match(e.message, /"closets" 테이블이 없습니다/);
  assert.match(classifyDbError({ code: '42703', message: 'column "memo" does not exist' }).message, /"memo" 컬럼/);
});
