-- +goose Up
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INT NOT NULL DEFAULT 0,
  features_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  start_date TEXT NOT NULL,
  next_billing_date TEXT NOT NULL,
  wash_count INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wash_events (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  location_id TEXT REFERENCES locations(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result TEXT NOT NULL,
  raw_qr TEXT NOT NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_wash_events_user_id ON wash_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- +goose Down
DROP TABLE IF EXISTS wash_events;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
