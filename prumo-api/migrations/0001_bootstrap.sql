CREATE SCHEMA IF NOT EXISTS bootstrap;

CREATE TABLE bootstrap.probe (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
