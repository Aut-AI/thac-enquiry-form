-- Webhook: fire notify-quote-accepted when enquiry status flips to 'accepted'.

CREATE OR REPLACE FUNCTION trigger_notify_quote_accepted()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM 'accepted') AND NEW.status = 'accepted' THEN
    PERFORM net.http_post(
      url     := 'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-quote-accepted',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
      ),
      body    := jsonb_build_object('record', row_to_json(NEW), 'old_record', row_to_json(OLD))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_quote_accepted ON public.enquiries;
CREATE TRIGGER on_quote_accepted
  AFTER UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_quote_accepted();
