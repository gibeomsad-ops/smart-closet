-- 비밀번호 로그인 추가 (2026-10-20). 기존 데이터는 그대로 두고 컬럼만 추가합니다.
-- 이미 있는 옷장은 password_hash가 비어 있으며, 첫 로그인 때 입력한 비밀번호로 설정됩니다.
ALTER TABLE closets ADD COLUMN IF NOT EXISTS password_hash TEXT;
