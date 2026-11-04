-- Supabase Postgres schema for AIFSP Access
-- Run this ONCE in the Supabase SQL Editor (Dashboard -> SQL -> New query).
-- Tables mirror the original SQLite schema. Text timestamps are used on
-- purpose so date/time string comparisons behave identically to SQLite.

create table if not exists public.settings (
  key   text primary key,
  value text not null
);

create table if not exists public.students (
  id         text primary key,
  name       text not null,
  phone      text not null,
  purpose    text not null,
  campus     text not null default 'TESANO CAMPUS',
  created_at text not null,
  flagged    integer not null default 0,
  flag_note  text,
  sms_opt_out integer not null default 0,
  unique (phone, campus)
);

create table if not exists public.access_tokens (
  id          text primary key,
  student_id  text not null references public.students (id),
  campus      text not null default 'TESANO CAMPUS',
  token       text not null,
  valid_date  text not null,
  created_at  text not null,
  used_at     text not null,
  verified_at text
);

create table if not exists public.sessions (
  id             text primary key,
  role           text not null,
  campus         text not null,
  is_super_admin boolean not null default false,
  created_at     text not null,
  expires_at     text not null
);

create table if not exists public.feedback (
  id         text primary key,
  student_id text references public.students (id),
  phone      text,
  campus     text not null default 'TESANO CAMPUS',
  rating     integer not null,
  category   text,
  comment    text,
  created_at text not null
);

create table if not exists public.sms_logs (
  id                     text primary key,
  campus                 text not null,
  recipient_name         text,
  recipient_phone_masked text not null,
  recipient_id           text,
  provider               text,
  provider_message_id     text,
  status                 text not null,
  delivery_status        text,
  source                 text not null,
  error                  text,
  created_at             text not null
);

create table if not exists public.retention_schedules (
  id            text primary key,
  campus        text not null,
  run_at        text not null,
  status        text not null,
  templates     text not null,
  recipient_ids text not null,
  cooldown_days integer not null,
  created_at    text not null,
  updated_at    text not null,
  result        text
);

create index if not exists idx_students_campus on public.students (campus);
create index if not exists idx_access_tokens_campus on public.access_tokens (campus);
create index if not exists idx_access_tokens_student on public.access_tokens (student_id);
create index if not exists idx_access_tokens_token on public.access_tokens (token, valid_date);
create index if not exists idx_sessions_expires on public.sessions (expires_at);
create index if not exists idx_feedback_campus on public.feedback (campus);
create index if not exists idx_sms_logs_campus_created on public.sms_logs (campus, created_at);
create index if not exists idx_sms_logs_recipient_created on public.sms_logs (recipient_id, created_at);
create index if not exists idx_sms_logs_provider_message_id on public.sms_logs (provider_message_id);
create index if not exists idx_retention_schedules_status_run_at on public.retention_schedules (status, run_at);

alter table public.sms_logs enable row level security;
alter table public.retention_schedules enable row level security;

-- The Express API uses the Supabase service_role key and authenticates admin
-- requests itself. No direct anon/authenticated client access is needed.
