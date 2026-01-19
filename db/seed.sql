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
