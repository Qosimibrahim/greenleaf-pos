
-- Stock commits ONLY when invoice is paid; reverts on cancel after paid.
CREATE OR REPLACE FUNCTION public.tg_invoice_stock_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND NOT COALESCE(OLD.stock_committed, false) THEN
    UPDATE public.products p
       SET quantity = GREATEST(p.quantity - li.quantity::int, 0)
      FROM public.invoice_line_items li
     WHERE li.invoice_id = NEW.id AND li.product_id = p.id;
    NEW.stock_committed := true;
  ELSIF NEW.status = 'cancelled' AND COALESCE(OLD.stock_committed, false) THEN
    UPDATE public.products p
       SET quantity = p.quantity + li.quantity::int
      FROM public.invoice_line_items li
     WHERE li.invoice_id = NEW.id AND li.product_id = p.id;
    NEW.stock_committed := false;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure trigger is attached (it was implied but not listed).
DROP TRIGGER IF EXISTS invoices_stock_transition ON public.invoices;
CREATE TRIGGER invoices_stock_transition
BEFORE UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.tg_invoice_stock_transition();
