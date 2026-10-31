-- TM.SA-SCHOOL: preserve schools/accounts; add contact and operational metadata.
ALTER TABLE public.app_schools
    ADD COLUMN address TEXT,
    ADD COLUMN contact_name TEXT,
    ADD COLUMN contact_email TEXT,
    ADD COLUMN contact_phone TEXT,
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.app_classes
    ADD COLUMN grade SMALLINT CHECK (grade BETWEEN 6 AND 9),
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
-- Only infer unambiguous existing class codes such as 6A1, 7B2. Unknown grades stay NULL.
UPDATE public.app_classes SET grade = left(class_code, 1)::smallint
    WHERE grade IS NULL AND class_code ~ '^[6-9]([^0-9]|$)';
CREATE INDEX app_classes_directory_idx ON public.app_classes (school_id, grade, school_year, is_active);
-- Existing tables retain their RLS and school_scope policies; no public grants.
