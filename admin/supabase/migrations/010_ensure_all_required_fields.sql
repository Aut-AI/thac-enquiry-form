-- Comprehensive migration to ensure jobs and enquiries tables have all required fields
-- This uses IF NOT EXISTS to safely add missing columns without errors

-- ENQUIRIES TABLE
-- Add all acceptance and client detail fields if they don't exist
ALTER TABLE enquiries
ADD COLUMN IF NOT EXISTS billing_contact_name TEXT,
ADD COLUMN IF NOT EXISTS billing_contact_email TEXT,
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS end_client_name TEXT,
ADD COLUMN IF NOT EXISTS end_client_email TEXT,
ADD COLUMN IF NOT EXISTS report_addressee_name TEXT,
ADD COLUMN IF NOT EXISTS report_addressee_address TEXT,
ADD COLUMN IF NOT EXISTS report_title TEXT,
ADD COLUMN IF NOT EXISTS access_details TEXT,
ADD COLUMN IF NOT EXISTS parking_details TEXT,
ADD COLUMN IF NOT EXISTS site_boundary_polygon JSONB,
ADD COLUMN IF NOT EXISTS tc_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tc_accepted_at TIMESTAMP;

-- JOBS TABLE
-- Add all fields needed for auto-created jobs
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS enquiry_id UUID REFERENCES enquiries(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS job_number TEXT,
ADD COLUMN IF NOT EXISTS billing_contact_name TEXT,
ADD COLUMN IF NOT EXISTS billing_contact_email TEXT,
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS report_addressee_name TEXT,
ADD COLUMN IF NOT EXISTS report_addressee_address TEXT,
ADD COLUMN IF NOT EXISTS report_title TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_enquiry_id ON jobs(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_jobs_job_number ON jobs(job_number);
CREATE INDEX IF NOT EXISTS idx_enquiries_tc_accepted ON enquiries(tc_accepted, tc_accepted_at DESC) WHERE tc_accepted = true;
