-- 신발은 두께 없이 저장 (2026-10-21).
-- 신발은 thickness가 NULL, 나머지 옷은 지금처럼 thin/medium/thick 중 하나가 필수입니다.
BEGIN;
ALTER TABLE clothes ALTER COLUMN thickness DROP NOT NULL;
UPDATE clothes SET thickness = NULL WHERE category = 'shoes';
ALTER TABLE clothes ADD CONSTRAINT clothes_thickness_by_category CHECK (
  (category = 'shoes' AND thickness IS NULL) OR (category <> 'shoes' AND thickness IS NOT NULL)
);
COMMIT;
