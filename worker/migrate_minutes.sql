ALTER TABLE users RENAME COLUMN credits TO minutes;
ALTER TABLE sessions RENAME COLUMN credits_deducted TO minutes_used;
ALTER TABLE purchases RENAME COLUMN credits TO minutes;
