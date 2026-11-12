-- Chuyển kho nội dung, trò chơi, AI và nghiên cứu sang không gian riêng của trường.
-- Các dòng cũ vẫn là mẫu hệ thống, chỉ đọc từ không gian trường. Không xóa dữ liệu.
SET CONSTRAINTS ALL IMMEDIATE;
-- Các quyền đã chuyển sang trường; những quyền quản lý toàn hệ thống vẫn giữ nguyên.
UPDATE public.hk_permissions SET baseline=true,allowed=true
 WHERE role='school_admin' AND feature_key IN
 ('history_warehouse','game_content','war_content','ai_manage','quiz_author','journey_design','ai_tutor');
UPDATE public.hk_permission_features SET note='Quản trị trường chỉ quản lý bản riêng trong trường; mẫu hệ thống chỉ đọc.'
 WHERE key IN ('history_warehouse','game_content','war_content','ai_manage');
CREATE FUNCTION public.app_workspace_school() RETURNS integer LANGUAGE sql STABLE AS $$
 SELECT NULLIF(NULLIF(current_setting('app.school_id', true), ''), '0')::integer
$$;

DO $$
DECLARE t text; c record;
BEGIN
  FOREACH t IN ARRAY ARRAY['hist_campaigns','hist_places','hist_figures','hist_events','hist_battles','hist_sources','hist_terms','hist_links','hist_versions',
    'hk_character_classes','hk_cards','hk_shop_items','hk_quest_templates','hk_scenarios','hk_minigames','hk_commanders','hk_stages','hk_march_maps','hk_game_assets',
    'hk_ai_docs','hk_ai_chunks','hk_survey_templates','hk_experiment_groups','hk_levels','hk_settings','hk_ai_settings','hk_lessons','hk_dialogs','hk_league_weeks']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN school_id integer REFERENCES public.app_schools(id) ON DELETE CASCADE',t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN school_id SET DEFAULT public.app_workspace_school()',t);
    EXECUTE format('CREATE INDEX ON public.%I(school_id)',t);
    -- Giữ quy tắc duy nhất của mẫu cũ; các trường có thể dùng cùng mã với nhau.
    FOR c IN SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid=format('public.%I',t)::regclass AND contype='u'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',t,c.conname);
      EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I %s',c.conname || '_global',t,
        replace(substring(c.def from '\(.*\)'),')',') WHERE school_id IS NULL'));
      EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (school_id, %s',c.conname || '_school',t,
        substring(substring(c.def from '\(.*\)') from 2));
    END LOOP;
  END LOOP;
END $$;

-- FK PostgreSQL bỏ qua RLS khi kiểm tra tồn tại; chặn tham chiếu chéo trường ngay tại DB.
CREATE FUNCTION public.app_workspace_check_refs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE f record; parent jsonb; owner integer; sid integer; uid integer;
BEGIN
 uid:=NULLIF(current_setting('app.user_id',true),'')::integer;
 IF uid IS NULL THEN RETURN NEW; END IF;
 sid:=public.app_workspace_school();
 FOR f IN SELECT k.confrelid AS target,a.attname AS col,b.attname AS pk
   FROM pg_constraint k JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=k.conkey[1]
   JOIN pg_attribute b ON b.attrelid=k.confrelid AND b.attnum=k.confkey[1]
   WHERE k.conrelid=TG_RELID AND k.contype='f' AND array_length(k.conkey,1)=1
   AND a.attname NOT IN('created_by','updated_by','assigned_by','awarded_by','uploaded_by','labeled_by','handled_by','locked_by','deleted_by','graded_by','copied_from')
 LOOP
   IF to_jsonb(NEW)->>f.col IS NULL THEN CONTINUE; END IF;
   EXECUTE format('SELECT to_jsonb(p) FROM %s p WHERE %I::text=$1',f.target::regclass,f.pk) INTO parent USING to_jsonb(NEW)->>f.col;
   IF parent IS NULL THEN CONTINUE; END IF; -- FK thường xử lý bản ghi không tồn tại.
   owner:=public.app_workspace_owner(f.target,parent);
   IF owner<>0 AND owner<>-2147483648 AND owner IS DISTINCT FROM sid AND owner<>-uid THEN
     RAISE EXCEPTION 'Reference outside school workspace' USING ERRCODE='42501';
   END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.app_workspace_check_refs() FROM PUBLIC;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND (c.relname LIKE 'hk\_%' ESCAPE '\' OR c.relname LIKE 'hist\_%' ESCAPE '\')
 LOOP EXECUTE format('CREATE TRIGGER workspace_refs BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.app_workspace_check_refs()',t.relname); END LOOP;
END $$;

-- Giữ nguyên khóa nghiệp vụ trong từng trường.
ALTER TABLE public.hk_levels DROP CONSTRAINT hk_levels_pkey;
ALTER TABLE public.hk_settings DROP CONSTRAINT hk_settings_pkey;
ALTER TABLE public.hk_ai_settings DROP CONSTRAINT hk_ai_settings_pkey;
ALTER TABLE public.hk_league_weeks DROP CONSTRAINT hk_league_weeks_pkey;
ALTER TABLE public.hk_levels ADD COLUMN workspace_key integer GENERATED ALWAYS AS (coalesce(school_id,0)) STORED;
ALTER TABLE public.hk_settings ADD COLUMN workspace_key integer GENERATED ALWAYS AS (coalesce(school_id,0)) STORED;
ALTER TABLE public.hk_ai_settings ADD COLUMN workspace_key integer GENERATED ALWAYS AS (coalesce(school_id,0)) STORED;
ALTER TABLE public.hk_league_weeks ADD COLUMN user_id integer REFERENCES public.app_users(id) ON DELETE CASCADE
 DEFAULT CASE WHEN public.app_workspace_school() IS NULL THEN NULLIF(current_setting('app.user_id',true),'')::integer END;
ALTER TABLE public.hk_league_weeks ADD COLUMN workspace_key integer GENERATED ALWAYS AS (coalesce(school_id,-user_id,0)) STORED;
ALTER TABLE public.hk_levels ADD PRIMARY KEY(workspace_key,level);
ALTER TABLE public.hk_settings ADD PRIMARY KEY(workspace_key,key);
ALTER TABLE public.hk_ai_settings ADD PRIMARY KEY(workspace_key,id);
ALTER TABLE public.hk_league_weeks ADD PRIMARY KEY(workspace_key,week_key);
-- Giữ dấu chốt tuần đã xử lý để không trao thưởng lần hai cho dữ liệu cũ.
INSERT INTO public.hk_league_weeks(school_id,week_key,closed_at)
 SELECT s.id,w.week_key,w.closed_at FROM public.app_schools s CROSS JOIN public.hk_league_weeks w WHERE w.school_id IS NULL;
INSERT INTO public.hk_league_weeks(user_id,week_key,closed_at)
 SELECT u.id,w.week_key,w.closed_at FROM public.app_users u CROSS JOIN public.hk_league_weeks w
 WHERE u.school_id IS NULL AND u.role<>'root_admin' AND w.school_id IS NULL AND w.user_id IS NULL;

ALTER TABLE public.hk_settings ADD COLUMN is_customized boolean NOT NULL DEFAULT false;
ALTER TABLE public.hk_ai_settings ADD COLUMN is_customized boolean NOT NULL DEFAULT false;
ALTER TABLE public.hk_ai_settings ADD COLUMN use_system_model boolean NOT NULL DEFAULT true;

CREATE TABLE public.app_school_workspaces (
 school_id integer PRIMARY KEY REFERENCES public.app_schools(id) ON DELETE CASCADE,
 initialized_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_school_workspaces ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.hk_journeys'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%is_default%'
 LOOP EXECUTE format('ALTER TABLE public.hk_journeys DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
ALTER TABLE public.hk_journeys ADD CONSTRAINT hk_journeys_default_scope CHECK(NOT is_default OR scope IN('system','school'));
DROP INDEX public.hk_journeys_default_key;
CREATE UNIQUE INDEX hk_journeys_default_key ON public.hk_journeys(coalesce(school_id,0),campaign_id) WHERE is_default;

-- Hàm nội bộ tìm trường qua khóa ngoại, không gây đệ quy chính sách RLS.
-- Tên bảng chỉ lấy từ pg_catalog, không nhận từ HTTP.
CREATE FUNCTION public.app_workspace_owner(tab regclass, data jsonb, depth integer DEFAULT 0)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE f record; parent jsonb; result integer; uid integer;
BEGIN
 IF depth>12 THEN RETURN -2147483648; END IF;
 IF tab='public.app_schools'::regclass THEN RETURN (data->>'id')::integer; END IF;
 IF tab='public.hk_league_weeks'::regclass AND data->>'school_id' IS NULL AND data->>'user_id' IS NOT NULL THEN RETURN -(data->>'user_id')::integer; END IF;
 IF data ? 'school_id' THEN
   IF data->>'school_id' IS NOT NULL THEN RETURN (data->>'school_id')::integer; END IF;
   IF tab='public.app_users'::regclass THEN RETURN -(data->>'id')::integer; END IF;
   RETURN 0;
 END IF;
 FOR f IN
   SELECT k.confrelid AS target, a.attname AS local_col, b.attname AS target_col
   FROM pg_constraint k JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=k.conkey[1]
     JOIN pg_attribute b ON b.attrelid=k.confrelid AND b.attnum=k.confkey[1]
   WHERE k.conrelid=tab AND k.contype='f' AND array_length(k.conkey,1)=1
     AND a.attname NOT IN ('created_by','updated_by','assigned_by','awarded_by','uploaded_by','labeled_by','handled_by','locked_by','deleted_by','graded_by')
     AND (k.confrelid<>'public.app_users'::regclass OR a.attname IN ('user_id','student_id','teacher_id','owner_id'))
   -- Xác định chủ sở hữu qua bản ghi chứa nội dung, trước các tư liệu được tham chiếu.
   -- Ví dụ nút thuộc hành trình riêng vẫn có thể dùng quiz mẫu của hệ thống.
   ORDER BY CASE a.attname WHEN 'user_id' THEN 0 WHEN 'class_id' THEN 1 WHEN 'owner_id' THEN 1 WHEN 'journey_id' THEN 2
     WHEN 'lesson_id' THEN 3 WHEN 'quiz_id' THEN 4 WHEN 'node_id' THEN 5 ELSE 6 END
 LOOP
   IF data->>f.local_col IS NULL THEN CONTINUE; END IF;
   EXECUTE format('SELECT to_jsonb(p) FROM %s p WHERE %I::text=$1',f.target::regclass,f.target_col) INTO parent USING data->>f.local_col;
   IF parent IS NOT NULL THEN
     result:=public.app_workspace_owner(f.target,parent,depth+1);
     IF result<>-2147483648 THEN RETURN result; END IF;
   END IF;
 END LOOP;
 RETURN -2147483648;
END $$;
REVOKE ALL ON FUNCTION public.app_workspace_owner(regclass,jsonb,integer) FROM PUBLIC;

DO $$
DECLARE t record; own text; read_rule text; write_rule text; shared boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dong_a_workspace_scope') THEN
   CREATE ROLE dong_a_workspace_scope NOLOGIN NOINHERIT NOBYPASSRLS;
 END IF;
 EXECUTE format('GRANT dong_a_workspace_scope TO %I',current_user);
 GRANT USAGE ON SCHEMA public TO dong_a_workspace_scope;
 GRANT EXECUTE ON FUNCTION public.app_workspace_owner(regclass,jsonb,integer) TO dong_a_workspace_scope;
 GRANT EXECUTE ON FUNCTION public.app_workspace_school() TO dong_a_workspace_scope;
 FOR t IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND (c.relname LIKE 'hk\_%' ESCAPE '\' OR c.relname LIKE 'hist\_%' ESCAPE '\' OR c.relname LIKE 'app\_%' ESCAPE '\') AND c.relname<>'app_schema_migrations'
 LOOP
   own:=format('public.app_workspace_owner(%L::regclass,to_jsonb(%I))', 'public.'||t.relname,t.relname);
   write_rule:=format('((public.app_workspace_school() IS NOT NULL AND %s=public.app_workspace_school()) OR %s=-NULLIF(current_setting(''app.user_id'',true),'''')::integer)',own,own);
   shared:=t.relname=ANY(ARRAY['hist_campaigns','hist_places','hist_figures','hist_events','hist_battles','hist_sources','hist_terms','hist_links','hist_versions',
     'hk_character_classes','hk_cards','hk_badges','hk_shop_items','hk_quest_templates','hk_scenarios','hk_minigames','hk_commanders','hk_stages','hk_march_maps','hk_march_points','hk_march_edges','hk_dialogs','hk_card_moves','hk_game_assets',
     'hk_questions','hk_question_links','hk_question_versions','hk_quizzes','hk_quiz_questions','hk_lessons','hk_lesson_links','hk_lesson_checks','hk_journeys','hk_nodes','hk_gates','hk_node_edges','hk_node_unlocks','hk_media',
     'hk_ai_docs','hk_ai_chunks','hk_survey_templates','hk_experiment_groups']);
   read_rule:=write_rule;
   IF shared THEN read_rule:=format('(%s OR %s=0)',read_rule,own); END IF;
   IF t.relname=ANY(ARRAY['hk_settings','hk_ai_settings']) THEN read_rule:=format('(%s OR %s=0)',write_rule,own); END IF;
   IF t.relname='hk_levels' THEN
     read_rule:=format('(%s OR (public.app_workspace_school() IS NULL AND %s=0))',write_rule,own);
   END IF;
   IF t.relname=ANY(ARRAY['hk_system_settings','hk_feature_flags','hk_permissions','hk_permission_features','hk_faq','hk_reco_settings']) THEN read_rule:='true'; END IF;
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.relname);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO dong_a_workspace_scope',t.relname);
   EXECUTE format('CREATE POLICY workspace_read ON public.%I FOR SELECT TO dong_a_workspace_scope USING(%s)',t.relname,read_rule);
   EXECUTE format('CREATE POLICY workspace_insert ON public.%I FOR INSERT TO dong_a_workspace_scope WITH CHECK(%s)',t.relname,write_rule);
   EXECUTE format('CREATE POLICY workspace_update ON public.%I FOR UPDATE TO dong_a_workspace_scope USING(%s) WITH CHECK(%s)',t.relname,write_rule,write_rule);
   EXECUTE format('CREATE POLICY workspace_delete ON public.%I FOR DELETE TO dong_a_workspace_scope USING(%s)',t.relname,write_rule);
 END LOOP;
 -- Chỉ cấp các sequence của bảng ứng dụng, không cấp quyền cho anon/authenticated của Supabase.
 FOR t IN SELECT s.oid::regclass AS seq FROM pg_class s JOIN pg_depend d ON d.objid=s.oid
   JOIN pg_class c ON c.oid=d.refobjid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE s.relkind='S' AND n.nspname='public' AND (c.relname LIKE 'hk\_%' ESCAPE '\' OR c.relname LIKE 'hist\_%' ESCAPE '\' OR c.relname LIKE 'app\_%' ESCAPE '\')
 LOOP EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE %s TO dong_a_workspace_scope',t.seq); END LOOP;
END $$;
