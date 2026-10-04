DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.staff_shifts
    WHERE clock_in_at IS NOT NULL
      AND clock_out_at IS NULL
    GROUP BY restaurant_id, user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve duplicate active staff attendance rows before applying this migration.';
  END IF;
END
$$;

ALTER TABLE public.staff_shifts
  ALTER COLUMN start_time DROP NOT NULL,
  ALTER COLUMN end_time DROP NOT NULL;

ALTER TABLE public.staff_shifts
  DROP CONSTRAINT IF EXISTS staff_shifts_status_check;

ALTER TABLE public.staff_shifts
  ADD CONSTRAINT staff_shifts_status_check
  CHECK (status IN ('SCHEDULED', 'UNSCHEDULED', 'COMPLETED', 'CANCELLED'));

CREATE UNIQUE INDEX IF NOT EXISTS staff_shifts_one_active_attendance_per_user_idx
  ON public.staff_shifts (restaurant_id, user_id)
  WHERE clock_in_at IS NOT NULL AND clock_out_at IS NULL;

CREATE OR REPLACE FUNCTION public.start_staff_attendance(
  p_restaurant_id uuid,
  p_shift_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clock_in_at timestamptz := clock_timestamp();
  v_shift record;
  v_shift_id uuid;
  v_late boolean := false;
BEGIN
  IF v_user_id IS NULL OR NOT public.has_restaurant_role(
    p_restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER', 'CHEF', 'BARMAN']
  ) THEN
    RAISE EXCEPTION 'Active staff membership was not found for this restaurant.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_restaurant_id::text), hashtext(v_user_id::text));

  IF EXISTS (
    SELECT 1
    FROM public.staff_shifts
    WHERE restaurant_id = p_restaurant_id
      AND user_id = v_user_id
      AND clock_in_at IS NOT NULL
      AND clock_out_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You are already clocked in for this shift.' USING ERRCODE = '23505';
  END IF;

  IF p_shift_id IS NULL THEN
    INSERT INTO public.staff_shifts (
      restaurant_id, user_id, shift_date, start_time, end_time, status, clock_in_at, late
    ) VALUES (
      p_restaurant_id,
      v_user_id,
      (v_clock_in_at AT TIME ZONE 'Africa/Addis_Ababa')::date,
      NULL,
      NULL,
      'UNSCHEDULED',
      v_clock_in_at,
      false
    )
    RETURNING id INTO v_shift_id;
  ELSE
    SELECT id, shift_date, start_time, end_time, status, clock_in_at, clock_out_at
      INTO v_shift
    FROM public.staff_shifts
    WHERE id = p_shift_id
      AND restaurant_id = p_restaurant_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Scheduled shift was not found for this staff member.' USING ERRCODE = 'P0002';
    END IF;
    IF v_shift.shift_date <> (v_clock_in_at AT TIME ZONE 'Africa/Addis_Ababa')::date THEN
      RAISE EXCEPTION 'Scheduled shift was not found for this staff member.' USING ERRCODE = 'P0002';
    END IF;
    IF v_shift.status IN ('COMPLETED', 'CANCELLED') OR v_shift.clock_out_at IS NOT NULL THEN
      RAISE EXCEPTION 'This shift has already been completed.' USING ERRCODE = '23514';
    END IF;
    IF v_shift.status <> 'SCHEDULED' OR v_shift.clock_in_at IS NOT NULL THEN
      RAISE EXCEPTION 'You are already clocked in for this shift.' USING ERRCODE = '23505';
    END IF;

    v_late := v_shift.start_time IS NOT NULL
      AND v_clock_in_at >= ((v_shift.shift_date + v_shift.start_time) AT TIME ZONE 'Africa/Addis_Ababa');

    UPDATE public.staff_shifts
    SET clock_in_at = v_clock_in_at,
        late = v_late,
        updated_at = v_clock_in_at
    WHERE id = p_shift_id
      AND restaurant_id = p_restaurant_id
      AND user_id = v_user_id
      AND clock_in_at IS NULL
      AND clock_out_at IS NULL
    RETURNING id INTO v_shift_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'You are already clocked in for this shift.' USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE public.restaurant_users
  SET duty_status = 'ON_DUTY'
  WHERE restaurant_id = p_restaurant_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active staff membership was not found for this restaurant.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'shift_id', v_shift_id,
    'clock_in_at', v_clock_in_at,
    'late', v_late,
    'status', CASE WHEN p_shift_id IS NULL THEN 'UNSCHEDULED' ELSE 'SCHEDULED' END
  );
END
$$;

CREATE OR REPLACE FUNCTION public.end_staff_attendance(
  p_restaurant_id uuid,
  p_shift_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clock_out_at timestamptz := clock_timestamp();
  v_shift_id uuid;
BEGIN
  IF v_user_id IS NULL OR NOT public.has_restaurant_role(
    p_restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER', 'CHEF', 'BARMAN']
  ) THEN
    RAISE EXCEPTION 'Active staff membership was not found for this restaurant.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_restaurant_id::text), hashtext(v_user_id::text));

  UPDATE public.staff_shifts
  SET clock_out_at = v_clock_out_at,
      late = false,
      updated_at = v_clock_out_at
  WHERE id = p_shift_id
    AND restaurant_id = p_restaurant_id
    AND user_id = v_user_id
    AND clock_in_at IS NOT NULL
    AND clock_out_at IS NULL
  RETURNING id INTO v_shift_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You must clock in before you can clock out.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.restaurant_users
  SET duty_status = 'OFF_DUTY'
  WHERE restaurant_id = p_restaurant_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active staff membership was not found for this restaurant.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'shift_id', v_shift_id,
    'clock_out_at', v_clock_out_at,
    'status', 'OFF_DUTY'
  );
END
$$;

REVOKE ALL ON FUNCTION public.start_staff_attendance(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.end_staff_attendance(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_staff_attendance(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_staff_attendance(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
