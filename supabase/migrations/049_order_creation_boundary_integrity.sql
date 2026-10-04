-- Remove direct client INSERT paths while preserving the atomic order RPC.
-- Abort if the current RPC owner cannot insert or is a client role.
-- Preserve existing effective INSERT access for the RPC owner and service_role.

DO $migration$
DECLARE
  v_function_owner name;
  v_service_role_exists boolean;
  v_owner_had_insert boolean;
  v_service_role_had_insert boolean;
  v_table_name text;
  v_table_oid oid;
BEGIN
  SELECT r.rolname
    INTO v_function_owner
  FROM pg_proc p
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.oid = to_regprocedure(
    'public.create_order_atomic(text,text,text,uuid,text,text,jsonb)'
  );

  IF v_function_owner IS NULL THEN
    RAISE EXCEPTION 'create_order_atomic was not found; refusing to change table privileges.';
  END IF;

  IF v_function_owner IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION
      'create_order_atomic is owned by a client role; refusing to revoke INSERT.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'service_role'
  ) INTO v_service_role_exists;

  FOREACH v_table_name IN ARRAY ARRAY['orders', 'order_items', 'kitchen_orders']
  LOOP
    v_table_oid := to_regclass(format('public.%I', v_table_name));

    IF v_table_oid IS NULL THEN
      RAISE EXCEPTION 'Required table public.% does not exist; refusing to continue.', v_table_name;
    END IF;

    v_owner_had_insert :=
      has_table_privilege(v_function_owner, v_table_oid, 'INSERT');

    IF NOT v_owner_had_insert THEN
      RAISE EXCEPTION
        'Function owner % lacks INSERT on public.%; refusing to change privileges.',
        v_function_owner, v_table_name;
    END IF;

    v_service_role_had_insert := false;
    IF v_service_role_exists THEN
      v_service_role_had_insert :=
        has_table_privilege('service_role', v_table_oid, 'INSERT');
    END IF;

    EXECUTE format(
      'REVOKE INSERT ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      v_table_name
    );

    IF NOT has_table_privilege(v_function_owner, v_table_oid, 'INSERT') THEN
      EXECUTE format(
        'GRANT INSERT ON TABLE public.%I TO %I',
        v_table_name, v_function_owner
      );
    END IF;

    IF v_service_role_had_insert
       AND NOT has_table_privilege('service_role', v_table_oid, 'INSERT') THEN
      EXECUTE format(
        'GRANT INSERT ON TABLE public.%I TO service_role',
        v_table_name
      );
    END IF;
  END LOOP;
END
$migration$;