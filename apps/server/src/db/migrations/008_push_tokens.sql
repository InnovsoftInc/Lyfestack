-- Phase 5: add push_token column to users table
alter table users
  add column if not exists push_token text;

comment on column users.push_token is 'Expo push notification token for this user';
