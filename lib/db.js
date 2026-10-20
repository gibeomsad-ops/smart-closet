import { neon } from '@neondatabase/serverless';
import { ServiceError, classifyDbError } from './errors.js';

let sql;

function connect() {
  if (!sql) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new ServiceError('DB_CONFIG_MISSING', 503,
        'DB 설정이 없습니다. 서버 환경변수 DATABASE_URL을 등록해 주세요. (Vercel은 등록 후 재배포 필요)');
    }
    try {
      sql = neon(url);
    } catch (err) {
      throw classifyDbError(err) ?? new ServiceError('DB_CONFIG_INVALID', 503,
        'DATABASE_URL 형식이 올바르지 않습니다. Neon의 연결 문자열(postgresql://…)을 따옴표 없이 그대로 넣어 주세요.', err);
    }
  }
  return sql;
}

// 접속 정보는 DATABASE_URL 환경변수에서만 읽는다.
// 쿼리 오류는 원인 종류(ServiceError)로 바꿔서 던진다.
export function db() {
  const run = connect();
  return (strings, ...values) => run(strings, ...values).catch((err) => {
    throw classifyDbError(err) ?? err;
  });
}
