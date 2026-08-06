select cron.schedule(
  'inactivity-monitor-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--578df23e-8042-4ac1-8683-a82843cea2e9-dev.lovable.app/api/public/hooks/inactivity-monitor',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodWh3Y2x4b3R4ZGJ5d2lmam12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxODg4NTMsImV4cCI6MjA5OTc2NDQ1M30.jRe6max2mmWQ7RYraM3rQ6EL28O_id4oOe_qr4HsQzw"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);