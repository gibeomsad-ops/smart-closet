-- 옷 사진 (2026-10-20). 옷 1개당 사진 1장. 옷을 지우면 사진도 함께 지워집니다.
-- 사진은 브라우저에서 줄인 JPEG/PNG/WebP 원본 바이트를 그대로 저장합니다.
CREATE TABLE IF NOT EXISTS clothing_photos (
  clothing_id BIGINT PRIMARY KEY REFERENCES clothes(id) ON DELETE CASCADE,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  data BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
