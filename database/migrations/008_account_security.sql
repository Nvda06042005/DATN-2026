-- TM.SEC: durable token revocation, login history and operation audit.
-- No passwords, raw tokens or request bodies are stored in these logs.
ALTER TABLE public.app_users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0 CHECK (token_version >= 0);

CREATE TABLE public.app_revoked_tokens (
    token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_revoked_tokens_expiry_idx ON public.app_revoked_tokens (expires_at);
ALTER TABLE public.app_revoked_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_login_events (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    portal TEXT NOT NULL CHECK (portal IN ('root_admin', 'school_admin', 'teacher', 'student', 'app')),
    success BOOLEAN NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('success', 'credentials', 'locked', 'deleted', 'portal', 'rate_limit')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_login_events_scope_idx ON public.app_login_events (school_id, created_at DESC, id DESC);
CREATE INDEX app_login_events_user_idx ON public.app_login_events (user_id, created_at DESC, id DESC);
ALTER TABLE public.app_login_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_audit_events (
    id BIGSERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_audit_events_scope_idx ON public.app_audit_events (school_id, created_at DESC, id DESC);
CREATE INDEX app_audit_events_actor_idx ON public.app_audit_events (actor_id, created_at DESC, id DESC);
ALTER TABLE public.app_audit_events ENABLE ROW LEVEL SECURITY;

-- Only school-scoped SELECT. Inserts use the trusted backend connection.
-- No grants or policies for anon/authenticated; revoked tokens are never exposed.
GRANT SELECT ON public.app_login_events, public.app_audit_events TO dong_a_school_scope;
CREATE POLICY school_scope ON public.app_login_events FOR SELECT TO dong_a_school_scope
    USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);
CREATE POLICY school_scope ON public.app_audit_events FOR SELECT TO dong_a_school_scope
    USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);
