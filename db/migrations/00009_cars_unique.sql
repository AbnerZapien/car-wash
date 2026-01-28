-- +goose Up

-- 1) Deduplicate VIN (keep newest per user+vin)
DELETE FROM cars c
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, vin
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM cars
  WHERE vin IS NOT NULL AND btrim(vin) <> ''
) d
WHERE c.id = d.id
  AND d.rn > 1;

-- 2) Deduplicate plate (keep newest per user+plate)
DELETE FROM cars c
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, plate
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM cars
  WHERE plate IS NOT NULL AND btrim(plate) <> ''
) d
WHERE c.id = d.id
  AND d.rn > 1;

-- 3) Unique VIN per user (only when provided)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cars_user_vin
  ON cars(user_id, vin)
  WHERE vin IS NOT NULL AND btrim(vin) <> '';

-- 4) Unique plate per user (only when provided)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cars_user_plate
  ON cars(user_id, plate)
  WHERE plate IS NOT NULL AND btrim(plate) <> '';

-- +goose Down
DROP INDEX IF EXISTS ux_cars_user_plate;
DROP INDEX IF EXISTS ux_cars_user_vin;
