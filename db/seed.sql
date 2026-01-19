-- Seed data for car wash MVP (safe to run multiple times)

-- Plans
INSERT OR IGNORE INTO plans (id, name, price_cents, features_json) VALUES
  ('basic',   'Basic Wash',           1000, '["Exterior wash","Spot-free rinse"]'),
  ('premium', 'Premium Wash',         2500, '["Exterior + interior wipe","Tire shine","Spot-free rinse"]'),
  ('platinum','Platinum Unlimited',   4000, '["Unlimited washes","Priority lane","Premium detail discounts"]');

-- Locations
INSERT OR IGNORE INTO locations (id, name, address) VALUES
  ('loc-1', 'Hedgestone Carwash - Downtown',  '123 Main St, Hedgestone, TX'),
  ('loc-2', 'Hedgestone Carwash - Northside', '455 North Ave, Hedgestone, TX'),
  ('loc-3', 'Hedgestone Carwash - West',      '89 West Blvd, Hedgestone, TX');

-- Demo users for scan testing (safe to run multiple times)
INSERT OR IGNORE INTO users (id, username, password) VALUES
  (1, 'demo', 'demo'),
  (4, 'mia', 'demo123'),
  (5, 'carlos', 'demo123'),
  (6, 'priya', 'demo123');

-- Demo subscriptions for scan testing (active)
INSERT OR REPLACE INTO subscriptions (id, user_id, plan_id, status, start_date, next_billing_date, wash_count) VALUES
  ('sub-demo-1', 1, 'basic',   'active', '2026-01-01', '2026-02-01', 0),
  ('sub-demo-4', 4, 'premium', 'active', '2025-09-01', '2026-02-01', 9),
  ('sub-demo-5', 5, 'basic',   'active', '2025-11-10', '2026-01-25', 4),
  ('sub-demo-6', 6, 'platinum','active', '2025-06-15', '2026-02-10', 31);
