
-- ============= Chart of Accounts =============
CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','revenue','expense');

CREATE TABLE public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chart_of_accounts TO authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coa read staff" ON public.chart_of_accounts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "coa admin write" ON public.chart_of_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============= Bank / Cash registers =============
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'cash', -- cash | bank | mobile
  account_id UUID REFERENCES public.chart_of_accounts(id),
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bank_accounts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank read staff" ON public.bank_accounts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "bank admin write" ON public.bank_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_bank_updated BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============= Journal =============
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  memo TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "je admin read" ON public.journal_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jl admin read" ON public.journal_lines FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============= Tax settings (singleton) =============
CREATE TABLE public.tax_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tax_settings_single CHECK (id = true)
);
GRANT SELECT ON public.tax_settings TO authenticated;
GRANT INSERT, UPDATE ON public.tax_settings TO authenticated;
GRANT ALL ON public.tax_settings TO service_role;
ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax read staff" ON public.tax_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "tax admin write" ON public.tax_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============= Expenses =============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  expense_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.expenses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp admin all" ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============= Payroll =============
CREATE TABLE public.staff_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  base_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
  hourly_rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  hours_per_month NUMERIC(8,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_payroll TO authenticated;
GRANT ALL ON public.staff_payroll TO service_role;
ALTER TABLE public.staff_payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll admin all" ON public.staff_payroll FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_payroll_updated BEFORE UPDATE ON public.staff_payroll
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month DATE NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  total_gross NUMERIC(14,2) NOT NULL DEFAULT 0,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_by UUID
);
GRANT SELECT, INSERT ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prun admin all" ON public.payroll_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.payroll_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  gross_pay NUMERIC(14,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT ON public.payroll_run_items TO authenticated;
GRANT ALL ON public.payroll_run_items TO service_role;
ALTER TABLE public.payroll_run_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prit admin all" ON public.payroll_run_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============= Alter invoices =============
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id);

-- ============= Seed Chart of Accounts =============
INSERT INTO public.chart_of_accounts(code,name,type,is_system) VALUES
  ('1000','Cash on Hand','asset',true),
  ('1010','Store Bank Account','asset',true),
  ('1020','Mobile Money / POS','asset',true),
  ('1200','Inventory','asset',true),
  ('1300','Accounts Receivable','asset',true),
  ('2100','Sales Tax Payable','liability',true),
  ('3000','Owner Equity','equity',true),
  ('4000','Sales Revenue','revenue',true),
  ('5000','Cost of Goods Sold','expense',true),
  ('6100','Rent Expense','expense',true),
  ('6200','Utilities Expense','expense',true),
  ('6300','Payroll Expense','expense',true),
  ('6900','Other Expense','expense',true)
ON CONFLICT (code) DO NOTHING;

-- ============= Seed Bank accounts =============
INSERT INTO public.bank_accounts(name,kind,account_id) VALUES
  ('Main Cash Drawer','cash',(SELECT id FROM public.chart_of_accounts WHERE code='1000')),
  ('Store Bank Account','bank',(SELECT id FROM public.chart_of_accounts WHERE code='1010')),
  ('Mobile Money / POS','mobile',(SELECT id FROM public.chart_of_accounts WHERE code='1020'))
ON CONFLICT DO NOTHING;

-- ============= Seed Tax settings =============
INSERT INTO public.tax_settings(id,rate) VALUES (true, 0.075) ON CONFLICT DO NOTHING;

-- ============= Trigger: Invoice paid -> Journal entry + bank balance =============
CREATE OR REPLACE FUNCTION public.tg_invoice_post_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_bank RECORD;
  v_entry_id UUID;
  v_cash_acct UUID;
  v_rev_acct UUID;
  v_tax_acct UUID;
  v_cogs_acct UUID;
  v_inv_acct UUID;
  v_total_cost NUMERIC(14,2);
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    IF NEW.bank_account_id IS NULL THEN
      RAISE EXCEPTION 'Cannot mark paid without a bank/cash account';
    END IF;
    SELECT * INTO v_bank FROM public.bank_accounts WHERE id = NEW.bank_account_id;
    v_cash_acct := v_bank.account_id;
    SELECT id INTO v_rev_acct FROM public.chart_of_accounts WHERE code='4000';
    SELECT id INTO v_tax_acct FROM public.chart_of_accounts WHERE code='2100';
    SELECT id INTO v_cogs_acct FROM public.chart_of_accounts WHERE code='5000';
    SELECT id INTO v_inv_acct FROM public.chart_of_accounts WHERE code='1200';

    INSERT INTO public.journal_entries(entry_date,memo,reference_type,reference_id,created_by)
      VALUES (CURRENT_DATE,'Invoice '||NEW.invoice_number||' payment','invoice',NEW.id,NEW.created_by)
      RETURNING id INTO v_entry_id;

    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit) VALUES
      (v_entry_id, v_cash_acct, NEW.total, 0),
      (v_entry_id, v_rev_acct, 0, NEW.subtotal - NEW.discount_amount);
    IF NEW.tax_amount > 0 THEN
      INSERT INTO public.journal_lines(entry_id,account_id,debit,credit) VALUES
        (v_entry_id, v_tax_acct, 0, NEW.tax_amount);
    END IF;

    -- COGS
    SELECT COALESCE(SUM(li.quantity::numeric * COALESCE(p.unit_cost,0)),0) INTO v_total_cost
      FROM public.invoice_line_items li LEFT JOIN public.products p ON p.id = li.product_id
      WHERE li.invoice_id = NEW.id;
    IF v_total_cost > 0 THEN
      INSERT INTO public.journal_lines(entry_id,account_id,debit,credit) VALUES
        (v_entry_id, v_cogs_acct, v_total_cost, 0),
        (v_entry_id, v_inv_acct, 0, v_total_cost);
    END IF;

    UPDATE public.bank_accounts SET balance = balance + NEW.total WHERE id = NEW.bank_account_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_invoice_post_journal AFTER UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_post_journal();

-- ============= Trigger: Expense -> Journal + decrement bank =============
CREATE OR REPLACE FUNCTION public.tg_expense_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_entry_id UUID; v_cash_acct UUID;
BEGIN
  SELECT account_id INTO v_cash_acct FROM public.bank_accounts WHERE id = NEW.bank_account_id;
  INSERT INTO public.journal_entries(entry_date,memo,reference_type,reference_id,created_by)
    VALUES (NEW.expense_date, NEW.description, 'expense', NEW.id, NEW.created_by)
    RETURNING id INTO v_entry_id;
  INSERT INTO public.journal_lines(entry_id,account_id,debit,credit) VALUES
    (v_entry_id, NEW.expense_account_id, NEW.amount, 0),
    (v_entry_id, v_cash_acct, 0, NEW.amount);
  UPDATE public.bank_accounts SET balance = balance - NEW.amount WHERE id = NEW.bank_account_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_expense_post AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_expense_post();

-- ============= Trigger: Payroll run -> Journal + decrement bank =============
CREATE OR REPLACE FUNCTION public.tg_payroll_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_entry_id UUID; v_cash_acct UUID; v_pay_acct UUID;
BEGIN
  SELECT account_id INTO v_cash_acct FROM public.bank_accounts WHERE id = NEW.bank_account_id;
  SELECT id INTO v_pay_acct FROM public.chart_of_accounts WHERE code='6300';
  INSERT INTO public.journal_entries(entry_date,memo,reference_type,reference_id,created_by)
    VALUES (CURRENT_DATE, 'Payroll '||to_char(NEW.period_month,'Mon YYYY'), 'payroll', NEW.id, NEW.run_by)
    RETURNING id INTO v_entry_id;
  INSERT INTO public.journal_lines(entry_id,account_id,debit,credit) VALUES
    (v_entry_id, v_pay_acct, NEW.total_gross, 0),
    (v_entry_id, v_cash_acct, 0, NEW.total_gross);
  UPDATE public.bank_accounts SET balance = balance - NEW.total_gross WHERE id = NEW.bank_account_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_payroll_post AFTER INSERT ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_payroll_post();

-- ============= Update signup handler to honor demo role metadata =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE user_count INT; assigned public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url');

  IF NEW.raw_user_meta_data->>'demo_role' IN ('admin','staff') THEN
    assigned := (NEW.raw_user_meta_data->>'demo_role')::public.app_role;
  ELSE
    SELECT COUNT(*) INTO user_count FROM public.user_roles;
    IF user_count = 0 THEN assigned := 'admin'; ELSE assigned := 'staff'; END IF;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, assigned) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- ============= Seed sample products =============
INSERT INTO public.products(name, sku, barcode, quantity, low_stock_threshold, unit_cost, selling_price)
VALUES
  ('Premium Wireless Headset','SKU-1111','1111',25,5,30.00,75.00),
  ('Ergonomic Office Chair','SKU-2222','2222',12,3,80.00,199.99),
  ('Ultra-Thin Laptop Sleeve','SKU-3333','3333',40,10,10.00,29.99)
ON CONFLICT (sku) DO NOTHING;

-- Seed one demo client and 2 invoices (paid + draft) — only if no invoices exist
DO $$
DECLARE
  v_client UUID; v_inv_paid UUID; v_inv_draft UUID;
  v_bank UUID; v_p1 UUID; v_p2 UUID; v_p3 UUID;
  v_entry UUID; v_cash_acct UUID; v_rev UUID; v_tax UUID; v_cogs UUID; v_inv UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.invoices) THEN RETURN; END IF;

  INSERT INTO public.clients(name,email,company) VALUES ('Demo Retail Customer','demo@customer.example','Demo Co')
    RETURNING id INTO v_client;
  SELECT id INTO v_bank FROM public.bank_accounts WHERE name='Main Cash Drawer';
  SELECT id INTO v_p1 FROM public.products WHERE sku='SKU-1111';
  SELECT id INTO v_p2 FROM public.products WHERE sku='SKU-2222';
  SELECT id INTO v_p3 FROM public.products WHERE sku='SKU-3333';

  -- Paid invoice: 2x headset + 1x sleeve, tax 7.5%
  INSERT INTO public.invoices(invoice_number,client_id,status,issue_date,paid_at,subtotal,tax_rate,tax_amount,total,payment_method,bank_account_id,stock_committed)
  VALUES ('INV-2026-00001', v_client, 'paid', CURRENT_DATE - 10, now() - interval '10 days',
    179.99, 0.075, 13.50, 193.49, 'cash', v_bank, true)
  RETURNING id INTO v_inv_paid;
  INSERT INTO public.invoice_line_items(invoice_id,product_id,description,quantity,unit_price,line_total) VALUES
    (v_inv_paid, v_p1, 'Premium Wireless Headset', 2, 75.00, 150.00),
    (v_inv_paid, v_p3, 'Ultra-Thin Laptop Sleeve', 1, 29.99, 29.99);

  -- Draft invoice
  INSERT INTO public.invoices(invoice_number,client_id,status,issue_date,subtotal,tax_rate,tax_amount,total)
  VALUES ('INV-2026-00002', v_client, 'draft', CURRENT_DATE - 2, 199.99, 0.075, 15.00, 214.99)
  RETURNING id INTO v_inv_draft;
  INSERT INTO public.invoice_line_items(invoice_id,product_id,description,quantity,unit_price,line_total) VALUES
    (v_inv_draft, v_p2, 'Ergonomic Office Chair', 1, 199.99, 199.99);

  -- Manually post journal for the seeded paid invoice (trigger runs on UPDATE, not INSERT)
  SELECT account_id INTO v_cash_acct FROM public.bank_accounts WHERE id = v_bank;
  SELECT id INTO v_rev FROM public.chart_of_accounts WHERE code='4000';
  SELECT id INTO v_tax FROM public.chart_of_accounts WHERE code='2100';
  SELECT id INTO v_cogs FROM public.chart_of_accounts WHERE code='5000';
  SELECT id INTO v_inv FROM public.chart_of_accounts WHERE code='1200';

  INSERT INTO public.journal_entries(entry_date,memo,reference_type,reference_id)
    VALUES (CURRENT_DATE - 10, 'Invoice INV-2026-00001 payment','invoice',v_inv_paid)
    RETURNING id INTO v_entry;
  INSERT INTO public.journal_lines(entry_id,account_id,debit,credit) VALUES
    (v_entry, v_cash_acct, 193.49, 0),
    (v_entry, v_rev, 0, 179.99),
    (v_entry, v_tax, 0, 13.50),
    (v_entry, v_cogs, 70.00, 0),   -- 2*30 + 1*10
    (v_entry, v_inv, 0, 70.00);

  UPDATE public.bank_accounts SET balance = balance + 193.49 WHERE id = v_bank;
  UPDATE public.products SET quantity = quantity - 2 WHERE id = v_p1;
  UPDATE public.products SET quantity = quantity - 1 WHERE id = v_p3;
END $$;
