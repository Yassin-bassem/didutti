
-- App settings (single-row config table)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App settings are publicly accessible"
ON public.app_settings
FOR ALL
USING (true)
WITH CHECK (true);

-- Seed defaults
INSERT INTO public.app_settings (key, value) VALUES
  ('admin_password', '2580'),
  ('instapay_link', 'https://ipn.eg/S/diagc/instapay/92UO1b'),
  ('instapay_label', 'diagc@instapay'),
  ('vodafone_number', '01098795115')
ON CONFLICT (key) DO NOTHING;

-- Staff permissions (array of permission keys)
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}';
