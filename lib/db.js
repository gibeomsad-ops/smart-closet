import { neon } from '@neondatabase/serverless';

let sql;

// 첫 쿼리 때 연결을 만든다. 접속 정보는 DATABASE_URL 환경변수에서만 읽는다.
export function db() {
  if (!sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}
