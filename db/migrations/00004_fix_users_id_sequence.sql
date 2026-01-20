-- +goose Up
-- Ensure the users.id sequence is set to at least the current MAX(id)
SELECT setval(
  pg_get_serial_sequence('users', 'id'),
  COALESCE((SELECT MAX(id) FROM users), 0),
  true
);

-- +goose Down
-- no-op
