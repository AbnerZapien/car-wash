-- +goose Up
CREATE TABLE IF NOT EXISTS cars (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  nickname TEXT NOT NULL DEFAULT '',
  vin TEXT NOT NULL DEFAULT '',

  year INT,
  make TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  trim TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  plate TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional uniqueness for VIN per user (only when VIN is present)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cars_user_vin_present
ON cars(user_id, vin)
WHERE vin <> '';

CREATE INDEX IF NOT EXISTS idx_cars_user_id ON cars(user_id);
CREATE INDEX IF NOT EXISTS idx_cars_vin ON cars(vin);

-- +goose Down
DROP INDEX IF EXISTS idx_cars_vin;
DROP INDEX IF EXISTS idx_cars_user_id;
DROP INDEX IF EXISTS ux_cars_user_vin_present;
DROP TABLE IF EXISTS cars;
