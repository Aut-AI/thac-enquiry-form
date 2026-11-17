-- Push notifications: the surveyor app stores its Expo push token here.
-- Surveyors can update their own row (RLS), so no policy change is needed.
ALTER TABLE public.surveyors ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
