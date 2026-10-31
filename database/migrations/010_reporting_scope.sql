-- Preserve completed competitions and capture their school/class context for reporting.
ALTER TABLE public.app_live_sessions
    ADD COLUMN school_id INTEGER REFERENCES public.app_schools(id) ON DELETE SET NULL,
    ADD COLUMN class_id INTEGER REFERENCES public.app_classes(id) ON DELETE SET NULL,
    ADD COLUMN school_year TEXT,
    ADD COLUMN grade SMALLINT CHECK (grade BETWEEN 6 AND 9);
-- Old matches only identify the teacher: preserve that current school as a legacy attribution.
-- Never guess an old school year from a class code that may be reused across years.
UPDATE public.app_live_sessions l SET school_id = u.school_id
    FROM public.app_users u WHERE u.id = l.teacher_id;
CREATE INDEX app_live_sessions_reporting_idx ON public.app_live_sessions (school_id, school_year, grade);
GRANT SELECT ON public.app_live_sessions, public.app_live_results TO dong_a_school_scope;
CREATE POLICY school_scope ON public.app_live_sessions FOR SELECT TO dong_a_school_scope
    USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);
CREATE POLICY school_scope ON public.app_live_results FOR SELECT TO dong_a_school_scope
    USING (session_id IN (SELECT id FROM public.app_live_sessions));
