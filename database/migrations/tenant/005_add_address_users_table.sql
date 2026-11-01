-- users: address fields
ALTER TABLE users
  ADD COLUMN address VARCHAR(255) NULL AFTER phone,
  ADD COLUMN city VARCHAR(80) NULL AFTER address,
  ADD COLUMN state VARCHAR(80) NULL AFTER city,
  ADD COLUMN pincode VARCHAR(10) NULL AFTER state;

UPDATE users SET phone = NULL WHERE phone = '';

ALTER TABLE users ADD UNIQUE KEY uq_users_phone (phone);

INSERT INTO settings (k, company_id, v) VALUES
  ('tagline',   1, 'Light Up Your Celebrations'),
  ('address',   1, '4/58, ChinnaramalingaPuram, MudhaliPatti, Sivakasi, 626189'),
  ('phone2',    1, '+919585009820'),
  ('email',     1, 'customercare@mkcrackers.in'),
  ('hours',     1, 'Open 24/7 - Always Available'),
  ('whatsapp',  1, '919952678110'),
  ('facebook',  1, ''),
  ('instagram', 1, ''),
  ('youtube',   1, '')
ON DUPLICATE KEY UPDATE v = VALUES(v);

UPDATE settings SET v = '+919952678110' WHERE k = 'phone';

