-- Apply to existing Supabase projects to store date of birth for new registrations.
alter table public.students add column if not exists date_of_birth text;

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
