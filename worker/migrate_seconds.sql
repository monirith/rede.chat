ALTER TABLE users RENAME COLUMN minutes TO seconds;
UPDATE users SET seconds = seconds * 60;
ALTER TABLE sessions RENAME COLUMN minutes_used TO seconds_used;
UPDATE sessions SET seconds_used = seconds_used * 60;
ALTER TABLE purchases RENAME COLUMN minutes TO seconds;
UPDATE purchases SET seconds = seconds * 60;
