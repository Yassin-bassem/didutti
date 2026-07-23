CREATE OR REPLACE FUNCTION public.deduct_stock_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    multiplier INTEGER := 1;
    ot TEXT;
BEGIN
    SELECT order_type INTO ot FROM public.orders WHERE id = NEW.order_id;

    IF ot IS DISTINCT FROM 'piece'
       AND NEW.product_description IS NOT NULL
       AND NEW.product_description ~ '/[0-9]+$' THEN
        multiplier := CAST(SUBSTRING(NEW.product_description FROM '/([0-9]+)$') AS INTEGER);
    END IF;

    UPDATE public.products
    SET stock_quantity = stock_quantity - (NEW.quantity * multiplier)
    WHERE id = NEW.product_id;

    RETURN NEW;
END;
$function$;