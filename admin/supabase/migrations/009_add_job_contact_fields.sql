-- Add contact and acceptance detail fields to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS job_number TEXT,
ADD COLUMN IF NOT EXISTS billing_contact_name TEXT,
ADD COLUMN IF NOT EXISTS billing_contact_email TEXT,
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS report_addressee_name TEXT,
ADD COLUMN IF NOT EXISTS report_addressee_address TEXT,
ADD COLUMN IF NOT EXISTS report_title TEXT;

-- Create unique index on job_number for quick lookups
CREATE INDEX IF NOT EXISTS idx_jobs_job_number ON jobs(job_number);
