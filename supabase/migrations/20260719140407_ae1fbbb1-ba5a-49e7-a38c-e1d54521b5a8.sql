UPDATE public.clients SET service_type = 'Custody' WHERE service_type = 'Escrow';
UPDATE public.leads SET services = array_replace(services, 'Escrow', 'Custody') WHERE 'Escrow' = ANY(services);