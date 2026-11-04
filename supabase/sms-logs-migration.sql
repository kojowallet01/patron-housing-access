create table if not exists public.sms_logs (
  id                     text primary key,
  campus                 text not null,
  recipient_name         text,
  recipient_phone_masked text not null,
  provider               text,
  status                 text not null,
  source                 text not null,
  error                  text,
  created_at             text not null
);

create index if not exists idx_sms_logs_campus_created on public.sms_logs (campus, created_at);
