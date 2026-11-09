-- Run in Supabase SQL Editor for existing projects.
-- Adds a separate class timetable, booking, and class-attendance domain.

alter table public.students add column if not exists date_of_birth text;

create table if not exists public.academic_terms (
  id text primary key,
  campus text not null,
  name text not null,
  start_date text not null,
  end_date text not null,
  status text not null default 'inactive',
  created_at text not null,
  updated_at text not null
);

create table if not exists public.class_schedules (
  id text primary key,
  term_id text not null references public.academic_terms (id),
  campus text not null,
  title text not null,
  description text not null default '',
  day_of_week integer not null,
  start_time text not null,
  end_time text not null,
  classroom text not null,
  capacity integer not null,
  instructor text not null default '',
  status text not null default 'draft',
  created_at text not null,
  updated_at text not null
);

create table if not exists public.class_bookings (
  id text primary key,
  class_id text not null references public.class_schedules (id),
  student_id text not null references public.students (id),
  campus text not null,
  class_date text not null,
  status text not null default 'booked',
  class_title_snapshot text not null,
  description_snapshot text not null default '',
  day_of_week_snapshot integer not null,
  start_time_snapshot text not null,
  end_time_snapshot text not null,
  classroom_snapshot text not null,
  instructor_snapshot text not null default '',
  created_at text not null,
  updated_at text not null,
  calendar_added_at text
);

create table if not exists public.class_attendance (
  id text primary key,
  booking_id text not null unique references public.class_bookings (id),
  class_id text not null references public.class_schedules (id),
  student_id text not null references public.students (id),
  class_date text not null,
  status text not null,
  verified_by text not null,
  verified_at text not null
);

create table if not exists public.class_notifications (
  id text primary key,
  booking_id text not null references public.class_bookings (id),
  student_id text not null references public.students (id),
  event text not null,
  status text not null,
  provider text,
  provider_message_id text,
  error text,
  created_at text not null
);

create unique index if not exists idx_academic_terms_one_active
  on public.academic_terms (campus) where status = 'active';
alter table public.class_bookings
  add column if not exists calendar_added_at text;
alter table public.class_bookings
  drop constraint if exists class_bookings_class_id_student_id_class_date_key;
create unique index if not exists idx_class_bookings_one_active_per_date
  on public.class_bookings (class_id, student_id, class_date) where status = 'booked';
create index if not exists idx_class_schedules_term_status
  on public.class_schedules (term_id, status);
create index if not exists idx_class_bookings_campus_date
  on public.class_bookings (class_date, status);
create index if not exists idx_class_bookings_student_date
  on public.class_bookings (student_id, class_date);
create index if not exists idx_class_attendance_date_status
  on public.class_attendance (class_date, status);

alter table public.academic_terms enable row level security;
alter table public.class_schedules enable row level security;
alter table public.class_bookings enable row level security;
alter table public.class_attendance enable row level security;
alter table public.class_notifications enable row level security;

revoke all on table
  public.academic_terms,
  public.class_schedules,
  public.class_bookings,
  public.class_attendance,
  public.class_notifications
from anon, authenticated;

grant all on table
  public.academic_terms,
  public.class_schedules,
  public.class_bookings,
  public.class_attendance,
  public.class_notifications
to service_role;

create or replace function public.create_class_booking(
  p_id text,
  p_class_id text,
  p_student_id text,
  p_class_date text,
  p_today text,
  p_created_at text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.class_schedules%rowtype;
  v_term public.academic_terms%rowtype;
  v_booking public.class_bookings%rowtype;
  v_booked integer;
begin
  select * into v_class
  from public.class_schedules
  where id = p_class_id
  for update;
  if not found or v_class.status <> 'published' then
    raise exception 'Class is not open for booking';
  end if;

  select * into v_term from public.academic_terms where id = v_class.term_id;
  if not found or v_term.status <> 'active' then
    raise exception 'Academic term is not active';
  end if;

  if p_class_date < p_today
    or p_class_date < v_term.start_date
    or p_class_date > v_term.end_date
    or extract(dow from p_class_date::date)::integer <> v_class.day_of_week then
    raise exception 'Class date is outside the schedule';
  end if;

  select count(*) into v_booked
  from public.class_bookings
  where class_id = p_class_id and class_date = p_class_date and status = 'booked';
  if v_booked >= v_class.capacity then
    raise exception 'Class is full';
  end if;

  insert into public.class_bookings (
    id, class_id, student_id, campus, class_date, status,
    class_title_snapshot, description_snapshot, day_of_week_snapshot,
    start_time_snapshot, end_time_snapshot, classroom_snapshot,
    instructor_snapshot, created_at, updated_at
  ) values (
    p_id, v_class.id, p_student_id, v_class.campus, p_class_date, 'booked',
    v_class.title, v_class.description, v_class.day_of_week,
    v_class.start_time, v_class.end_time, v_class.classroom,
    v_class.instructor, p_created_at, p_created_at
  ) returning * into v_booking;

  return to_jsonb(v_booking);
end;
$$;

revoke all on function public.create_class_booking(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_class_booking(text, text, text, text, text, text)
  to service_role;

create or replace function public.register_student_with_class_bookings(
  p_student jsonb,
  p_bookings jsonb,
  p_today text,
  p_current_time text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_class public.class_schedules%rowtype;
  v_term public.academic_terms%rowtype;
  v_booking public.class_bookings%rowtype;
  v_selected jsonb;
  v_date text;
  v_booked integer;
  v_created_bookings jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_bookings) <> 'array' or jsonb_array_length(p_bookings) < 1 then
    raise exception 'Select at least one valid class session to complete registration';
  end if;

  insert into public.students (id, name, phone, purpose, date_of_birth, campus, created_at)
  values (
    p_student->>'id',
    p_student->>'name',
    p_student->>'phone',
    p_student->>'purpose',
    p_student->>'date_of_birth',
    p_student->>'campus',
    p_student->>'created_at'
  ) returning * into v_student;

  for v_selected in select value from jsonb_array_elements(p_bookings)
  loop
    v_date := v_selected->>'class_date';
    select * into v_class
    from public.class_schedules
    where id = v_selected->>'class_id'
      and campus = v_student.campus
    for update;
    if not found or v_class.status <> 'published' then
      raise exception 'Class is not open for booking';
    end if;

    select * into v_term
    from public.academic_terms
    where id = v_class.term_id and campus = v_student.campus;
    if not found or v_term.status <> 'active' then
      raise exception 'Academic term is not active';
    end if;

    if v_date < p_today
      or v_date::date < v_term.start_date::date
      or v_date::date > v_term.end_date::date
      or extract(dow from v_date::date)::integer <> v_class.day_of_week then
      raise exception 'Class date is outside the schedule';
    end if;
    if v_date = p_today and p_current_time >= v_class.end_time then
      raise exception 'This class session has already ended and cannot be booked';
    end if;

    select count(*) into v_booked
    from public.class_bookings
    where class_id = v_class.id and class_date = v_date and status = 'booked';
    if v_booked >= v_class.capacity then
      raise exception 'Class is full';
    end if;

    insert into public.class_bookings (
      id, class_id, student_id, campus, class_date, status,
      class_title_snapshot, description_snapshot, day_of_week_snapshot,
      start_time_snapshot, end_time_snapshot, classroom_snapshot,
      instructor_snapshot, created_at, updated_at
    ) values (
      v_selected->>'id', v_class.id, v_student.id, v_student.campus, v_date, 'booked',
      v_class.title, v_class.description, v_class.day_of_week,
      v_class.start_time, v_class.end_time, v_class.classroom,
      v_class.instructor, v_student.created_at, v_student.created_at
    ) returning * into v_booking;
    v_created_bookings := v_created_bookings || jsonb_build_array(to_jsonb(v_booking));
  end loop;

  return jsonb_build_object('student', to_jsonb(v_student), 'bookings', v_created_bookings);
end;
$$;

revoke all on function public.register_student_with_class_bookings(jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.register_student_with_class_bookings(jsonb, jsonb, text, text)
  to service_role;

create or replace function public.get_class_attendance_analytics(
  p_campus text,
  p_start_date text,
  p_end_date text
) returns jsonb
language sql
security definer
set search_path = public
as $$
  with sessions as (
    select
      b.class_id,
      b.class_title_snapshot as title,
      b.class_date,
      c.capacity,
      count(*) as registrations,
      count(*) filter (where a.status = 'present') as attended,
      count(*) filter (where a.status = 'absent') as absent
    from public.class_bookings b
    join public.class_schedules c on c.id = b.class_id
    left join public.class_attendance a on a.booking_id = b.id
    where b.campus = p_campus
      and b.class_date between p_start_date and p_end_date
      and b.status = 'booked'
    group by b.class_id, b.class_title_snapshot, b.class_date, c.capacity
  ),
  scheduled_sessions as (
    select c.capacity
    from public.class_schedules c
    join public.academic_terms t on t.id = c.term_id
    cross join lateral generate_series(
      greatest(p_start_date::date, t.start_date::date)::timestamp,
      least(p_end_date::date, t.end_date::date)::timestamp,
      interval '1 day'
    ) as occurrence(class_day)
    where c.campus = p_campus
      and c.status = 'published'
      and t.start_date::date <= p_end_date::date
      and t.end_date::date >= p_start_date::date
      and extract(dow from occurrence.class_day)::integer = c.day_of_week
  ),
  class_stats as (
    select
      class_id,
      title,
      sum(registrations) as registrations,
      sum(attended) as attended,
      sum(absent) as absent
    from sessions
    group by class_id, title
  ),
  totals as (
    select
      coalesce(sum(registrations), 0) as total_bookings,
      coalesce(sum(attended), 0) as attended,
      coalesce(sum(absent), 0) as absent,
      coalesce(sum(registrations - attended - absent), 0) as pending,
      coalesce((select sum(capacity) from scheduled_sessions), 0) as capacity
    from sessions
  ),
  daily_trends as (
    select
      class_date as date,
      sum(registrations) as registrations,
      sum(attended) as attended,
      sum(absent) as absent,
      sum(registrations - attended - absent) as pending
    from sessions
    group by class_date
  ),
  repeat_absences as (
    select
      a.student_id,
      s.name,
      s.phone,
      count(*) as absence_count
    from public.class_attendance a
    join public.class_bookings b on b.id = a.booking_id
    join public.students s on s.id = a.student_id
    where b.campus = p_campus
      and a.class_date between p_start_date and p_end_date
      and a.status = 'absent'
    group by a.student_id, s.name, s.phone
    having count(*) >= 2
  )
  select jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'totalBookings', total_bookings,
        'attended', attended,
        'absent', absent,
        'pending', pending,
        'capacity', capacity,
        'attendanceRate', case when attended + absent = 0 then 0
          else round(100.0 * attended / (attended + absent), 1) end,
        'capacityUtilization', case when capacity = 0 then 0
          else round(100.0 * total_bookings / capacity, 1) end
      )
      from totals
    ),
    'classes', coalesce((
      select jsonb_agg(to_jsonb(class_stats) order by registrations desc, title)
      from class_stats
    ), '[]'::jsonb),
    'dailyTrends', coalesce((
      select jsonb_agg(to_jsonb(daily_trends) order by date)
      from daily_trends
    ), '[]'::jsonb),
    'repeatAbsences', coalesce((
      select jsonb_agg(to_jsonb(repeat_absences) order by absence_count desc, name)
      from repeat_absences
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_class_attendance_analytics(text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_class_attendance_analytics(text, text, text)
  to service_role;
