CREATE TABLE users (
  id integer primary key autoincrement,
  openId text not null unique,
  name text,
  email text,
  loginMethod text,
  role text not null default 'user',
  createdAt integer not null default (unixepoch() * 1000),
  updatedAt integer not null default (unixepoch() * 1000),
  lastSignedIn integer not null default (unixepoch() * 1000)
);

CREATE TABLE user_profiles (
  user_id integer primary key references users(id) on delete cascade,
  department_role text,
  created_at integer not null default (unixepoch() * 1000),
  updated_at integer not null default (unixepoch() * 1000)
);

CREATE TABLE case_studies (
  id integer primary key autoincrement,
  user_id integer not null references users(id) on delete cascade,
  title text not null,
  description text not null,
  thumbnail_url text,
  thumbnail_key text,
  category text not null,
  tools text not null,
  challenge text not null,
  solution text not null,
  steps text not null,
  impact text,
  tags text not null,
  is_recommended integer not null default 0,
  created_at integer not null default (unixepoch() * 1000),
  updated_at integer not null default (unixepoch() * 1000)
);

CREATE TABLE favorites (
  id integer primary key autoincrement,
  user_id integer not null references users(id) on delete cascade,
  case_study_id integer not null references case_studies(id) on delete cascade,
  created_at integer not null default (unixepoch() * 1000)
);

CREATE UNIQUE INDEX favorites_user_case_unique
  ON favorites(user_id, case_study_id);

CREATE TABLE app_settings (
  key text primary key,
  value text,
  updated_at integer not null default (unixepoch() * 1000)
);
