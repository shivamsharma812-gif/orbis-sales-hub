
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS sub_category text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS priority public.priority_level NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS expected_close_date date,
  ADD COLUMN IF NOT EXISTS probability integer CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  ADD COLUMN IF NOT EXISTS referral_by text,
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimated_annual_revenue numeric;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS linkedin_url text;
