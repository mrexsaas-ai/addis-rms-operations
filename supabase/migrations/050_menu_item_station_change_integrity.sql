DO $preflight$
DECLARE
  v_required record;
BEGIN
  FOR v_required IN
    SELECT *
    FROM (VALUES
      ('public', 'menu_items', 'id'),
      ('public', 'menu_items', 'restaurant_id'),
      ('public', 'menu_items', 'station'),
      ('public', 'order_items', 'menu_item_id'),
      ('public', 'order_items', 'order_id'),
      ('public', 'order_items', 'restaurant_id'),
      ('public', 'orders', 'id'),
      ('public', 'orders', 'restaurant_id'),
      ('public', 'kitchen_orders', 'order_id'),
      ('public', 'kitchen_orders', 'restaurant_id'),
      ('public', 'kitchen_orders', 'status')
    ) AS required_columns(schema_name, table_name, column_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = v_required.schema_name
        AND c.table_name = v_required.table_name
        AND c.column_name = v_required.column_name
    ) THEN
      RAISE EXCEPTION 'Required column %.%.% does not exist; refusing to install the station-change guard.',
        v_required.schema_name, v_required.table_name, v_required.column_name;
    END IF;
  END LOOP;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.prevent_menu_item_station_change_with_open_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.station IS NOT DISTINCT FROM OLD.station THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o
      ON o.id = oi.order_id
     AND o.restaurant_id = oi.restaurant_id
    JOIN public.kitchen_orders ko
      ON ko.order_id = o.id
     AND ko.restaurant_id = o.restaurant_id
    WHERE oi.menu_item_id = OLD.id
      AND oi.restaurant_id = OLD.restaurant_id
      AND ko.status <> 'COMPLETED'
  ) THEN
    RAISE EXCEPTION 'A menu item station cannot be changed while it has an open station order.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_menu_item_station_change_with_open_orders()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_menu_item_station_change_with_open_orders
  ON public.menu_items;
CREATE TRIGGER prevent_menu_item_station_change_with_open_orders
  BEFORE UPDATE OF station ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_menu_item_station_change_with_open_orders();