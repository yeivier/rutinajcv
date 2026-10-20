-- Actualización diaria de la base de conocimiento de la IA (edge function forja-research).
-- Requiere una fila forja_ai_secrets(provider='research_token', api_key=<aleatorio>) que la función compara
-- con el header x-research-token. pg_cron + pg_net ya están habilitados en el proyecto.
select cron.schedule('forja-research-daily', '17 */6 * * *', $$select net.http_post(url := 'https://vzenlmcbftopyjzcltxa.supabase.co/functions/v1/forja-research', headers := jsonb_build_object('Content-Type','application/json','x-research-token',(select api_key from forja_ai_secrets where provider='research_token')), body := '{}'::jsonb, timeout_milliseconds := 140000)$$);
