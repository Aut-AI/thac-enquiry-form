-- Sprint 3: Surveyors table + link to jobs
-- Run in Supabase SQL Editor.

-- 1. Surveyors table
CREATE TABLE IF NOT EXISTS public.surveyors (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at               timestamptz DEFAULT now() NOT NULL,
  full_name                text NOT NULL,
  email                    text,
  phone                    text,
  hourly_rate              numeric(8,2),
  home_postcode            text,
  home_lat                 numeric(10,7),
  home_lng                 numeric(10,7),
  radius_miles             integer DEFAULT 25,
  pi_policy_number         text,
  pi_expiry_date           date,
  pl_policy_number         text,
  pl_expiry_date           date,
  dbs_number               text,
  dbs_expiry_date          date,
  professional_memberships text,
  qualifications           text,
  notes                    text,
  is_active                boolean NOT NULL DEFAULT true
);

-- 2. Link surveyors to jobs (set when surveyor claims a job)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS surveyor_id uuid REFERENCES public.surveyors(id);

-- Verification
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'surveyors'
-- ORDER BY ordinal_position;
