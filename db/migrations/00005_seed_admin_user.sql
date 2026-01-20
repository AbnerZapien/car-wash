-- +goose Up
INSERT INTO users (id, username, password, email, first_name, last_name, avatar_url)
VALUES (2, 'admin', 'admin123', 'admin@hedgestonecarwash.com', 'Admin', 'User', '')
ON CONFLICT (id) DO UPDATE SET
  username=EXCLUDED.username,
  password=EXCLUDED.password,
  email=EXCLUDED.email,
  first_name=EXCLUDED.first_name,
  last_name=EXCLUDED.last_name,
  avatar_url=EXCLUDED.avatar_url;

-- +goose Down
DELETE FROM users WHERE id = 2;
