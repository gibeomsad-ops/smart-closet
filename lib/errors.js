import crypto from 'node:crypto';

// 화면에 원인 종류(kind)와 해결 방법을 보여 주기 위한 오류.
// message에는 접속 정보나 키 값 같은 비밀을 절대 넣지 않는다.
export class ServiceError extends Error {
  constructor(kind, status, message, cause) {
    super(message, { cause });
    this.kind = kind;
    this.status = status;
  }
}

const DB_HELP = '서버 환경변수 DATABASE_URL을 확인해 주세요. (Vercel은 변경 후 재배포 필요)';

// SQL 오류 메시지에서 테이블·컬럼 이름만 뽑는다. ("relation "closets" does not exist")
const quoted = (msg) => msg?.match(/"([^"]+)"/)?.[1];

// DB 드라이버에서 나온 오류를 원인 종류별로 분류한다.
export function classifyDbError(err) {
  const code = err?.code;
  const msg = String(err?.message ?? '');
  const causeCode = err?.cause?.code ?? err?.sourceError?.cause?.code;

  if (code === '22P02') return null; // 잘못된 id 형식은 404로 따로 처리한다.

  if (code === '28P01' || code === '28000' || /password authentication failed/i.test(msg)) {
    return new ServiceError('DB_AUTH', 503, `DB 로그인에 실패했습니다. 연결 문자열의 사용자 이름·비밀번호와 호스트 주소(ep-로 시작하는 부분)가 맞는지 ${DB_HELP}`, err);
  }
  if (code === '3D000') {
    return new ServiceError('DB_NOT_FOUND', 503, `연결 문자열에 적힌 데이터베이스가 없습니다. ${DB_HELP}`, err);
  }
  if (code === '42P01') {
    const name = quoted(msg);
    return new ServiceError('DB_SCHEMA', 500, `DB에 ${name ? `"${name}" ` : ''}테이블이 없습니다. 연결한 DB가 맞는지, 테이블을 만들었는지 확인해 주세요. (db/schema.sql 참고)`, err);
  }
  if (code === '42703') {
    const name = quoted(msg);
    return new ServiceError('DB_SCHEMA', 500, `DB 테이블에 ${name ? `"${name}" ` : ''}컬럼이 없습니다. 테이블 구조를 db/schema.sql과 비교해 주세요.`, err);
  }
  if (/^23/.test(code ?? '')) {
    return new ServiceError('DB_CONSTRAINT', 500, `DB 제약조건 때문에 저장하지 못했습니다. (SQLSTATE ${code}) 테이블의 NOT NULL·외래키·CHECK 설정을 확인해 주세요.`, err);
  }
  if (/connection string|invalid url|Invalid URL/i.test(msg)) {
    return new ServiceError('DB_CONFIG_INVALID', 503, `DATABASE_URL 형식이 올바르지 않습니다. Neon의 연결 문자열(postgresql://…)을 따옴표 없이 그대로 넣어 주세요.`, err);
  }
  if (/Error connecting to database|fetch failed|timed? ?out|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(msg) ||
      ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(causeCode)) {
    return new ServiceError('DB_UNREACHABLE', 503, `DB 서버에 연결할 수 없습니다. 연결 문자열의 호스트 주소와 Neon 프로젝트가 켜져 있는지 ${DB_HELP}`, err);
  }
  if (code) {
    return new ServiceError('DB_QUERY', 500, `DB 처리 중 오류가 발생했습니다. (SQLSTATE ${code})`, err);
  }
  return null;
}

export const newErrorId = () => crypto.randomBytes(4).toString('hex');
