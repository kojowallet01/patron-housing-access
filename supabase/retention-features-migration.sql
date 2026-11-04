alter table public.students
  add column if not exists sms_opt_out integer not null default 0;

alter table public.sms_logs
  add column if not exists recipient_id text,
  add column if not exists provider_message_id text,
  add column if not exists delivery_status text;

create index if not exists idx_sms_logs_recipient_created
  on public.sms_logs (recipient_id, created_at);
create index if not exists idx_sms_logs_provider_message_id
  on public.sms_logs (provider_message_id);

create table if not exists public.retention_schedules (
  id            text primary key,
  campus        text not null,
  run_at        text not null,
  status        text not null,
  templates     text not null,
  recipient_ids text not null default '[]',
  cooldown_days integer not null,
  created_at    text not null,
  updated_at    text not null,
  result        text
);

alter table public.retention_schedules
  add column if not exists recipient_ids text not null default '[]';

create index if not exists idx_retention_schedules_status_run_at
  on public.retention_schedules (status, run_at);

alter table public.sms_logs enable row level security;
alter table public.retention_schedules enable row level security;
