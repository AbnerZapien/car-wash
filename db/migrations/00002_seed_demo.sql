-- +goose Up
INSERT INTO plans (id,name,price_cents,features_json) VALUES
('basic','Basic Wash',2900,'["Exterior wash","Interior vacuum","Window cleaning"]'),
('premium','Premium Wash',4900,'["Exterior + interior wipe","Tire shine","Spot-free rinse"]'),
('platinum','Platinum Unlimited',9900,'["Unlimited washes","Interior detail","Priority lane"]')
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,
  price_cents=EXCLUDED.price_cents,
  features_json=EXCLUDED.features_json;

INSERT INTO locations (id,name,address) VALUES
('loc-1','Main Street Location','123 Main St'),
('loc-2','Oakwood Plaza','456 Oakwood Ave'),
('loc-3','Airport Road','789 Airport Rd')
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,
  address=EXCLUDED.address;

INSERT INTO users (id,username,password,email,first_name,last_name,avatar_url) VALUES
(1,'demo','demo','','Demo','User',''),
(4,'mia','demo123','mia.torres@hedgestonecarwash.com','Mia','Torres','https://i.pravatar.cc/150?img=47'),
(5,'carlos','demo123','carlos.mendoza@hedgestonecarwash.com','Carlos','Mendoza','https://i.pravatar.cc/150?img=12'),
(6,'priya','demo123','priya.patel@hedgestonecarwash.com','Priya','Patel','https://i.pravatar.cc/150?img=5')
ON CONFLICT (id) DO UPDATE SET
  username=EXCLUDED.username,
  password=EXCLUDED.password,
  email=EXCLUDED.email,
  first_name=EXCLUDED.first_name,
  last_name=EXCLUDED.last_name,
  avatar_url=EXCLUDED.avatar_url;

INSERT INTO subscriptions (id,user_id,plan_id,status,start_date,next_billing_date,wash_count) VALUES
('sub-1',1,'basic','active','2025-01-01','2026-02-01',0),
('sub-4',4,'premium','active','2025-09-01','2026-02-01',0),
('sub-5',5,'basic','active','2025-11-10','2026-02-01',0),
('sub-6',6,'platinum','active','2025-06-15','2026-02-01',0)
ON CONFLICT (id) DO UPDATE SET
  user_id=EXCLUDED.user_id,
  plan_id=EXCLUDED.plan_id,
  status=EXCLUDED.status,
  start_date=EXCLUDED.start_date,
  next_billing_date=EXCLUDED.next_billing_date,
  wash_count=EXCLUDED.wash_count;

-- +goose Down
DELETE FROM wash_events;
DELETE FROM subscriptions;
DELETE FROM locations;
DELETE FROM plans;
DELETE FROM sessions;
DELETE FROM users;
