CREATE TABLE "Setting" (
  "key"   TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

INSERT INTO "Setting" ("key", "value") VALUES
  ('extra_pts_WORLD_CUP_WINNER', '10'),
  ('extra_pts_TOP_SCORER',       '5'),
  ('extra_pts_BEST_GOALKEEPER',  '3'),
  ('extra_bet_deadline',         '2026-07-19T21:00:00Z')
ON CONFLICT DO NOTHING;
