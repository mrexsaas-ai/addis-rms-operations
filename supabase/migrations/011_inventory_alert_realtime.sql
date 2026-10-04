-- Enable realtime delivery for the existing inventory audit event stream.
-- No new business columns or notification table are introduced.

alter table public.inventory_audit_logs replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_audit_logs'
  ) then
    alter publication supabase_realtime add table public.inventory_audit_logs;
  end if;
end
$$;
