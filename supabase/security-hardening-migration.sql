-- Run after supabase/schema.sql in the Supabase SQL Editor.
-- The Express API uses the service_role key; browser clients use no direct
-- Supabase access. RLS with no client policies denies anon/authenticated access.

alter table public.settings enable row level security;
alter table public.students enable row level security;
alter table public.access_tokens enable row level security;
alter table public.sessions enable row level security;
alter table public.feedback enable row level security;
alter table public.sms_logs enable row level security;
alter table public.retention_schedules enable row level security;

revoke all on table
  public.settings,
  public.students,
  public.access_tokens,
  public.sessions,
  public.feedback,
  public.sms_logs,
  public.retention_schedules
from anon, authenticated;

grant all on table
  public.settings,
  public.students,
  public.access_tokens,
  public.sessions,
  public.feedback,
  public.sms_logs,
  public.retention_schedules
to service_role;
