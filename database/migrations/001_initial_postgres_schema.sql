-- Baseline of do_an_tot_nghiep, previously imported into Supabase.
-- Existing tables and their rows are kept. No account data is stored in this file.
DO $baseline$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'UserRole'
    ) THEN
        CREATE TYPE public."UserRole" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');
    END IF;

    IF to_regclass('public."User"') IS NULL THEN
        CREATE TABLE public."User" (
            id TEXT NOT NULL,
            email TEXT NOT NULL,
            "passwordHash" TEXT NOT NULL,
            "fullName" TEXT NOT NULL,
            role public."UserRole" NOT NULL DEFAULT 'STUDENT',
            "avatarUrl" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "User_pkey" PRIMARY KEY (id)
        );
        CREATE UNIQUE INDEX "User_email_key" ON public."User" (email);
    END IF;

    IF to_regclass('public."Profile"') IS NULL THEN
        CREATE TABLE public."Profile" (
            id TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            bio TEXT,
            outfit TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "Profile_pkey" PRIMARY KEY (id),
            CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId")
                REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX "Profile_userId_key" ON public."Profile" ("userId");
    END IF;

    IF to_regclass('public."UserSettings"') IS NULL THEN
        CREATE TABLE public."UserSettings" (
            id TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            theme TEXT NOT NULL DEFAULT 'light',
            "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "UserSettings_pkey" PRIMARY KEY (id),
            CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId")
                REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX "UserSettings_userId_key" ON public."UserSettings" ("userId");
    END IF;

    IF to_regclass('public._prisma_migrations') IS NULL THEN
        CREATE TABLE public._prisma_migrations (
            id VARCHAR(36) NOT NULL,
            checksum VARCHAR(64) NOT NULL,
            finished_at TIMESTAMPTZ,
            migration_name VARCHAR(255) NOT NULL,
            logs TEXT,
            rolled_back_at TIMESTAMPTZ,
            started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            applied_steps_count INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id)
        );
    END IF;
END
$baseline$;

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
