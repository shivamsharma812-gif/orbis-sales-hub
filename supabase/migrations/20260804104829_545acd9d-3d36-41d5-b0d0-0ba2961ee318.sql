UPDATE public.leads SET client_type = 'Trading Member' WHERE client_type IN ('REIT','InvIT');
UPDATE public.clients SET client_type = 'Trading Member' WHERE client_type IN ('REIT','InvIT');
UPDATE public.leads SET industry = NULL WHERE industry IS NOT NULL;
UPDATE public.clients SET industry = NULL WHERE industry IS NOT NULL;