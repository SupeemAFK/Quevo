ALTER TABLE users RENAME CONSTRAINT users_role_check TO app_users_role_check;
ALTER TABLE users RENAME CONSTRAINT users_display_name_check TO app_users_display_name_check;
ALTER TABLE users RENAME CONSTRAINT users_email_check TO app_users_login_identifier_check;
ALTER TABLE users RENAME CONSTRAINT users_password_hash_check TO app_users_credential_hash_check;

ALTER INDEX users_email_unique RENAME TO app_users_login_identifier_unique;

ALTER TABLE users RENAME COLUMN email TO login_identifier;
ALTER TABLE users RENAME COLUMN password_hash TO credential_hash;
ALTER TABLE users RENAME TO app_users;
