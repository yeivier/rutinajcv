-- WHOOP 24/7: además del webhook (WHOOP avisa de cada dato nuevo), cada 10 minutos
-- se sincronizan todas las cuentas conectadas. Red de seguridad por si un aviso se pierde.
select cron.schedule('whoop-sync-10min', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://vzenlmcbftopyjzcltxa.supabase.co/functions/v1/whoop',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('action','sync','studentId',student_id,'days',3),
    timeout_milliseconds := 50000)
  from forja_whoop_accounts
$$);
