-- Supabase Postgres schema for Patron Housing Access
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

create index if not exists idx_students_campus on public.students (campus);
create index if not exists idx_access_tokens_campus on public.access_tokens (campus);
create index if not exists idx_access_tokens_student on public.access_tokens (student_id);
create index if not exists idx_access_tokens_token on public.access_tokens (token, valid_date);
create index if not exists idx_sessions_expires on public.sessions (expires_at);

-- The server uses the Supabase service role key, so it bypasses Row Level
-- Security. RLS is intentionally left disabled for these tables; if you want
-- belt-and-suspenders protection, enable RLS and add a policy for the
-- service role (service_role always bypasses RLS in Supabase).
alter table public.settings enable row level security;
alter table public.students enable row level security;
alter table public.access_tokens enable row level security;
alter table public.sessions enable row level security;

-- Allow only the service role (server) to access these tables.
create policy "service_role_all" on public.settings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service_role_all" on public.students for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service_role_all" on public.access_tokens for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service_role_all" on public.sessions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
