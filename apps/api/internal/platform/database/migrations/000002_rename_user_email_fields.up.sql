ALTER TABLE app_users RENAME TO users;
ALTER TABLE users RENAME COLUMN login_identifier TO email;
ALTER TABLE users RENAME COLUMN credential_hash TO password_hash;

ALTER INDEX app_users_login_identifier_unique RENAME TO users_email_unique;

ALTER TABLE users RENAME CONSTRAINT app_users_role_check TO users_role_check;
ALTER TABLE users RENAME CONSTRAINT app_users_display_name_check TO users_display_name_check;
ALTER TABLE users RENAME CONSTRAINT app_users_login_identifier_check TO users_email_check;
ALTER TABLE users RENAME CONSTRAINT app_users_credential_hash_check TO users_password_hash_check;
