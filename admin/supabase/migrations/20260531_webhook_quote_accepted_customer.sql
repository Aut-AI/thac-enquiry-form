-- Webhook trigger: send email to customer when quote is accepted
-- This webhook fires when enquiry status → 'accepted' and calls the notify-quote-accepted-to-customer function

CREATE OR REPLACE TRIGGER on_enquiry_status_accepted_customer
  AFTER UPDATE OF status ON public.enquiries
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status != 'accepted')
  EXECUTE FUNCTION supabase_functions.http_request(
    'POST',
    'https://lemppaqgpntadeylzzwn.supabase.co/functions/v1/notify-quote-accepted-to-customer',
    '{"Content-Type":"application/json"}',
    (SELECT to_jsonb(NEW)),
    '1000'
  );
