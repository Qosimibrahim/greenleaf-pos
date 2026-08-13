
-- =========================================
-- ROLES
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Updated-at trigger fn
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile + first user becomes admin, rest staff
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- CLIENTS
-- =========================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage clients" ON public.clients FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_clients_name ON public.clients (lower(name));

-- =========================================
-- PRODUCT CATEGORIES
-- =========================================
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage categories" ON public.product_categories FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================================
-- PRODUCTS
-- =========================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  description TEXT,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage products" ON public.products FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_products_name ON public.products (lower(name));
CREATE INDEX idx_products_barcode ON public.products (barcode);

-- Derived status view helper
CREATE OR REPLACE FUNCTION public.product_status(_qty INT, _threshold INT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _qty <= 0 THEN 'out_of_stock'
              WHEN _qty <= _threshold THEN 'low_stock'
              ELSE 'in_stock' END;
$$;

-- Auto-generate barcode if missing
CREATE OR REPLACE FUNCTION public.tg_autogen_barcode()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := 'CA-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(NEW.id::text,'-',''),1,8));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER products_autogen_barcode BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_autogen_barcode();

-- =========================================
-- PRODUCT IMAGES / DOCUMENTS
-- =========================================
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage product images" ON public.product_images FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.product_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_documents TO authenticated;
GRANT ALL ON public.product_documents TO service_role;
ALTER TABLE public.product_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage product docs" ON public.product_documents FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================================
-- INVOICES
-- =========================================
CREATE TYPE public.invoice_status AS ENUM ('draft','sent','overdue','paid','cancelled');

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_committed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_invoices_status ON public.invoices (status);
CREATE INDEX idx_invoices_client ON public.invoices (client_id);

-- Auto invoice number
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;
CREATE OR REPLACE FUNCTION public.tg_autonumber_invoice()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER invoices_autonumber BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_autonumber_invoice();

-- =========================================
-- INVOICE LINE ITEMS
-- =========================================
CREATE TABLE public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_line_items TO authenticated;
GRANT ALL ON public.invoice_line_items TO service_role;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage line items" ON public.invoice_line_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_line_items_invoice ON public.invoice_line_items (invoice_id);

-- Stock commit/revert when invoice status transitions
CREATE OR REPLACE FUNCTION public.tg_invoice_stock_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  should_commit BOOLEAN := NEW.status IN ('sent','paid','overdue');
BEGIN
  IF should_commit AND NOT COALESCE(OLD.stock_committed, false) THEN
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
END; $$;
CREATE TRIGGER invoices_stock_transition BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_stock_transition();

-- =========================================
-- RECEIPTS
-- =========================================
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL UNIQUE REFERENCES public.invoices(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL UNIQUE,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage receipts" ON public.receipts FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 1000;
CREATE OR REPLACE FUNCTION public.tg_autonumber_receipt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := 'RCP-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER receipts_autonumber BEFORE INSERT ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.tg_autonumber_receipt();
