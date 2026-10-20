-- 참고용 스키마. Neon에 이미 테이블이 있다면 실행할 필요가 없습니다.
CREATE TABLE IF NOT EXISTS closets (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clothes (
  id SERIAL PRIMARY KEY,
  closet_id INTEGER NOT NULL REFERENCES closets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('top', 'bottom', 'outer', 'shoes')),
  color_hex CHAR(7) NOT NULL,
  thickness TEXT NOT NULL CHECK (thickness IN ('thin', 'medium', 'thick')),
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outfits (
  id SERIAL PRIMARY KEY,
  closet_id INTEGER NOT NULL REFERENCES closets(id) ON DELETE CASCADE,
  top_id INTEGER NOT NULL REFERENCES clothes(id),
  bottom_id INTEGER NOT NULL REFERENCES clothes(id),
  outer_id INTEGER REFERENCES clothes(id),
  shoes_id INTEGER REFERENCES clothes(id),
  temperature NUMERIC(4, 1) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
