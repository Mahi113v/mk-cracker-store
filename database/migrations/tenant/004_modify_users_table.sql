
UPDATE users SET phone = RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) WHERE phone IS NOT NULL AND phone <> '';
