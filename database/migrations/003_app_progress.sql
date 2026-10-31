-- Learning progress used by the Python backend.
CREATE TABLE IF NOT EXISTS public.app_progress (
    user_id INTEGER PRIMARY KEY,
    xp INTEGER NOT NULL DEFAULT 0,
    gems INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    lessons_completed INTEGER NOT NULL DEFAULT 0,
    perfect_runs INTEGER NOT NULL DEFAULT 0,
    questions_answered INTEGER NOT NULL DEFAULT 0,
    questions_correct INTEGER NOT NULL DEFAULT 0,
    ai_questions INTEGER NOT NULL DEFAULT 0,
    day_xp INTEGER NOT NULL DEFAULT 0,
    day_lessons INTEGER NOT NULL DEFAULT 0,
    day_correct INTEGER NOT NULL DEFAULT 0,
    day_ai_questions INTEGER NOT NULL DEFAULT 0,
    last_active_date TEXT,
    day_key TEXT,
    pig_state TEXT,
    bkt_state TEXT,
    updated_at TEXT
);

ALTER TABLE public.app_progress ENABLE ROW LEVEL SECURITY;
