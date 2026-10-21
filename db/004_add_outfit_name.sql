-- 저장한 코디 이름 (2026-10-21). 비어 있으면 이름 없는 코디입니다.
ALTER TABLE outfits ADD COLUMN IF NOT EXISTS name TEXT;
