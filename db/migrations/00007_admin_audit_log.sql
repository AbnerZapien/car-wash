-- +goose Up
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_user_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON admin_audit_log(admin_user_id);

-- +goose Down
DROP TABLE IF EXISTS admin_audit_log;
