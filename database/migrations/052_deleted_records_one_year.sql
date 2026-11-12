-- Kho kiểm tra dữ liệu đã xóa qua giao diện, tách khỏi dữ liệu đang sử dụng.
-- Không phải tài khoản đăng nhập khác / Supabase project mới. Không có API đọc công khai.
CREATE TABLE public.app_deleted_records (
    id BIGSERIAL PRIMARY KEY,
    operation_id UUID NOT NULL,
    source_schema TEXT NOT NULL,
    source_table TEXT NOT NULL,
    record_key JSONB NOT NULL,
    row_data JSONB NOT NULL,
    related_data JSONB,
    actor_id INTEGER,
    actor_name TEXT,
    actor_role TEXT NOT NULL,
    actor_school_id INTEGER,
    school_id INTEGER,
    route TEXT,
    delete_kind TEXT NOT NULL CHECK (delete_kind IN ('delete', 'soft_delete', 'legacy_soft_delete')),
    deleted_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CHECK (expires_at > deleted_at)
);
-- Không FK tới trường/tài khoản: xóa nguồn không làm mất kho lưu và danh tính người thao tác.
CREATE INDEX app_deleted_records_expiry_idx ON public.app_deleted_records(expires_at);
CREATE INDEX app_deleted_records_operation_idx ON public.app_deleted_records(operation_id, source_table);
CREATE INDEX app_deleted_records_source_idx ON public.app_deleted_records(source_table, deleted_at DESC);
CREATE INDEX app_deleted_records_school_idx ON public.app_deleted_records(school_id, deleted_at DESC);
ALTER TABLE public.app_deleted_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_deleted_records FROM PUBLIC, dong_a_school_scope, dong_a_workspace_scope;
REVOKE ALL ON SEQUENCE public.app_deleted_records_id_seq FROM PUBLIC, dong_a_school_scope, dong_a_workspace_scope;
DO $$ DECLARE r TEXT; BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
            EXECUTE format('REVOKE ALL ON public.app_deleted_records FROM %I',r);
            EXECUTE format('REVOKE ALL ON SEQUENCE public.app_deleted_records_id_seq FROM %I',r);
        END IF;
    END LOOP;
END $$;
COMMENT ON TABLE public.app_deleted_records IS 'Dữ liệu xóa từ giao diện, giữ 1 năm từ deleted_at. Chỉ chủ database xem trong Supabase. Không lưu mật khẩu/OTP/khóa. Dọn bằng app_purge_deleted_records; không sao lưu vào hk_backups.';

-- Loại bí mật theo tên khóa, kể cả lồng trong JSON. token của tệp media là mã nhận diện tệp, không phải phiên đăng nhập.
CREATE FUNCTION public.app_archive_redact(value JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE result JSONB; item RECORD;
BEGIN
    IF jsonb_typeof(value)='object' THEN
        result:='{}'::jsonb;
        FOR item IN SELECT key,val FROM jsonb_each(value) AS e(key,val) LOOP
            IF item.key !~* '(password|passwd|secret|api[_-]?key|credential|recovery|backup[_-]?code|otp|token_hash|access_token|refresh_token|id_token|authorization|cookie|join_code|join_password)' THEN
                result:=result || jsonb_build_object(item.key,public.app_archive_redact(item.val));
            END IF;
        END LOOP;
        RETURN result;
    ELSIF jsonb_typeof(value)='array' THEN
        SELECT COALESCE(jsonb_agg(public.app_archive_redact(v) ORDER BY n),'[]'::jsonb) INTO result FROM jsonb_array_elements(value) WITH ORDINALITY AS e(v,n);
        RETURN result;
    END IF;
    RETURN value;
END $$;
REVOKE ALL ON FUNCTION public.app_archive_redact(JSONB) FROM PUBLIC;

-- SECURITY DEFINER chỉ ghi OLD của trigger; không cho vai trò ứng dụng INSERT/SELECT kho.
CREATE FUNCTION public.app_capture_deleted_record() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ctx JSONB; original JSONB:=to_jsonb(OLD); data JSONB; pk JSONB:='{}'; key TEXT;
    stamp TIMESTAMPTZ:=statement_timestamp(); related JSONB; sid INTEGER; inherited TIMESTAMPTZ;
BEGIN
    IF current_setting('app.archive_suppress',true)='on' THEN
        IF TG_OP='UPDATE' THEN RETURN NEW; ELSE RETURN OLD; END IF;
    END IF;
    ctx:=NULLIF(current_setting('app.deletion_context',true),'')::jsonb;
    -- Chỉ lưu thao tác đã được AuthGuard xác thực; không lưu dọn cache/OTP/chạy migration như một thao tác người dùng.
    IF ctx IS NULL OR ctx->>'actor_role' NOT IN ('root_admin','school_admin','teacher','student') THEN
        IF TG_OP='UPDATE' THEN RETURN NEW; ELSE RETURN OLD; END IF;
    END IF;
    IF TG_OP='UPDATE' THEN
        IF original->>'deleted_at' IS NOT NULL OR to_jsonb(NEW)->>'deleted_at' IS NULL THEN RETURN NEW; END IF;
        stamp:=(to_jsonb(NEW)->>'deleted_at')::timestamptz;
    ELSIF original->>'deleted_at' IS NOT NULL THEN
        stamp:=(original->>'deleted_at')::timestamptz;
    ELSIF TG_TABLE_NAME='hk_ai_messages' THEN
        SELECT deleted_at INTO inherited FROM public.hk_ai_conversations WHERE id=(original->>'conversation_id')::bigint;
        IF inherited IS NULL THEN
            SELECT deleted_at INTO inherited FROM public.app_deleted_records WHERE operation_id=(ctx->>'operation_id')::uuid AND source_table='hk_ai_conversations'
                AND record_key->>'id'=original->>'conversation_id' ORDER BY id DESC LIMIT 1;
        END IF;
    ELSIF TG_TABLE_NAME='hk_ai_reports' THEN
        SELECT c.deleted_at INTO inherited FROM public.hk_ai_messages m JOIN public.hk_ai_conversations c ON c.id=m.conversation_id WHERE m.id=(original->>'message_id')::bigint;
        IF inherited IS NULL THEN
            SELECT deleted_at INTO inherited FROM public.app_deleted_records WHERE operation_id=(ctx->>'operation_id')::uuid AND source_table='hk_ai_messages'
                AND record_key->>'id'=original->>'message_id' ORDER BY id DESC LIMIT 1;
        END IF;
    END IF;
    -- Xóa tài khoản sau khi đã ẩn hội thoại không được gia hạn thêm một năm cho bản đã xóa trước đó.
    stamp:=COALESCE(inherited,stamp);
    IF stamp+interval '1 year'<=statement_timestamp() THEN
        IF TG_OP='UPDATE' THEN RETURN NEW; ELSE RETURN OLD; END IF;
    END IF;
    FOR key IN SELECT jsonb_array_elements_text(TG_ARGV[0]::jsonb) LOOP pk:=pk || jsonb_build_object(key,original->key); END LOOP;
    data:=public.app_archive_redact(original);
    -- Bản gzip sao lưu có thể chứa hash mật khẩu và quá lớn: chỉ lưu metadata, không tạo một bản sao kéo dài hạn giữ.
    IF TG_TABLE_NAME='hk_backups' THEN data:=(data-'data') || '{"archive_omitted":["backup_binary"]}'::jsonb; END IF;
    IF TG_TABLE_NAME='hk_ai_conversations' AND TG_OP='UPDATE' THEN
        SELECT jsonb_build_object(
            'hk_ai_messages', COALESCE((SELECT jsonb_agg(public.app_archive_redact(to_jsonb(m))) FROM public.hk_ai_messages m WHERE conversation_id=OLD.id),'[]'::jsonb),
            'hk_ai_reports', COALESCE((SELECT jsonb_agg(public.app_archive_redact(to_jsonb(r))) FROM public.hk_ai_reports r JOIN public.hk_ai_messages m ON m.id=r.message_id WHERE m.conversation_id=OLD.id),'[]'::jsonb)) INTO related;
    END IF;
    sid:=NULLIF(original->>'school_id','')::integer;
    IF TG_TABLE_NAME='app_schools' THEN sid:=(original->>'id')::integer; END IF;
    INSERT INTO public.app_deleted_records(operation_id,source_schema,source_table,record_key,row_data,related_data,actor_id,actor_name,actor_role,actor_school_id,school_id,route,delete_kind,deleted_at,expires_at)
    VALUES ((ctx->>'operation_id')::uuid,TG_TABLE_SCHEMA,TG_TABLE_NAME,pk,data,related,(ctx->>'actor_id')::integer,ctx->>'actor_name',ctx->>'actor_role',
        NULLIF(ctx->>'actor_school_id','')::integer,COALESCE(sid,NULLIF(ctx->>'actor_school_id','')::integer),ctx->>'route',CASE WHEN TG_OP='UPDATE' THEN 'soft_delete' ELSE 'delete' END,stamp,stamp+interval '1 year');
    IF TG_OP='UPDATE' THEN RETURN NEW; ELSE RETURN OLD; END IF;
END $$;
REVOKE ALL ON FUNCTION public.app_capture_deleted_record() FROM PUBLIC;

-- Bảng nghiệp vụ + các bảng con bị CASCADE đều có trigger. Bảng mã xác thực/thư chứa mật khẩu không được lưu vào kho.
-- Migration tạo bảng nghiệp vụ mới phải gọi lại hàm này; kiểm thử đối chiếu danh sách để tránh bỏ sót.
CREATE FUNCTION public.app_install_delete_archives() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t RECORD; keys JSONB; installed INTEGER:=0;
BEGIN
    FOR t IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND (c.relname LIKE 'app\_%' ESCAPE '\' OR c.relname LIKE 'hk\_%' ESCAPE '\' OR c.relname LIKE 'hist\_%' ESCAPE '\')
        AND c.relname<>ALL(ARRAY['app_deleted_records','app_schema_migrations','app_revoked_tokens','app_password_resets','app_signup_otps','app_email_outbox','hk_two_factor','hk_two_factor_codes','hk_job_heartbeats','hk_ai_chunks','hk_recommendations'])
    LOOP
        SELECT COALESCE(jsonb_agg(a.attname ORDER BY k.n),'[]'::jsonb) INTO keys FROM pg_index i
        CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum,n) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
        WHERE i.indrelid=t.oid AND i.indisprimary;
        EXECUTE format('DROP TRIGGER IF EXISTS archive_before_delete ON public.%I',t.relname);
        EXECUTE format('CREATE TRIGGER archive_before_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.app_capture_deleted_record(%L)',t.relname,keys::text);
        IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t.oid AND attname='deleted_at' AND NOT attisdropped) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS archive_before_soft_delete ON public.%I',t.relname);
            EXECUTE format('CREATE TRIGGER archive_before_soft_delete BEFORE UPDATE OF deleted_at ON public.%I FOR EACH ROW EXECUTE FUNCTION public.app_capture_deleted_record(%L)',t.relname,keys::text);
        END IF;
        installed:=installed+1;
    END LOOP;
    RETURN installed;
END $$;
REVOKE ALL ON FUNCTION public.app_install_delete_archives() FROM PUBLIC;
SELECT public.app_install_delete_archives();

-- Hội thoại đã ẩn từ trước vẫn còn dữ liệu: giữ thời điểm xóa cũ, không đặt lại hạn một năm.
INSERT INTO public.app_deleted_records(operation_id,source_schema,source_table,record_key,row_data,related_data,actor_id,actor_role,school_id,delete_kind,deleted_at,expires_at)
SELECT gen_random_uuid(),'public','hk_ai_conversations',jsonb_build_object('id',c.id),public.app_archive_redact(to_jsonb(c)),
    jsonb_build_object('hk_ai_messages',COALESCE((SELECT jsonb_agg(public.app_archive_redact(to_jsonb(m))) FROM public.hk_ai_messages m WHERE m.conversation_id=c.id),'[]'::jsonb),
      'hk_ai_reports',COALESCE((SELECT jsonb_agg(public.app_archive_redact(to_jsonb(r))) FROM public.hk_ai_reports r JOIN public.hk_ai_messages m ON m.id=r.message_id WHERE m.conversation_id=c.id),'[]'::jsonb)),
    c.user_id,'system',u.school_id,'legacy_soft_delete',c.deleted_at,c.deleted_at+interval '1 year'
FROM public.hk_ai_conversations c LEFT JOIN public.app_users u ON u.id=c.user_id
WHERE c.deleted_at IS NOT NULL AND c.deleted_at+interval '1 year'>statement_timestamp();

CREATE FUNCTION public.app_purge_deleted_records() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE removed INTEGER; previous TEXT:=COALESCE(current_setting('app.archive_suppress',true),'');
BEGIN
    -- Không đưa bản đã hết hạn ngược vào kho. Không xóa dữ liệu đang hoạt động.
    PERFORM set_config('app.archive_suppress','on',true);
    DELETE FROM public.hk_ai_conversations WHERE deleted_at IS NOT NULL AND deleted_at+interval '1 year'<=statement_timestamp();
    DELETE FROM public.app_deleted_records WHERE expires_at<=statement_timestamp();
    GET DIAGNOSTICS removed=ROW_COUNT;
    PERFORM set_config('app.archive_suppress',previous,true);
    RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.app_purge_deleted_records() FROM PUBLIC;

-- pg_cron chạy trong PostgreSQL, độc lập với Render Free. Local không có extension vẫn kiểm thử bằng hàm purge và việc nền dự phòng.
DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
            PERFORM cron.schedule('dong-a-deleted-records-retention','17 * * * *','SELECT public.app_purge_deleted_records()');
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Không bật được pg_cron cho kho xóa; backend sẽ dọn khi khởi động và mỗi giờ. Kiểm tra trạng thái retention sau triển khai.';
        END;
    END IF;
END $$;

CREATE FUNCTION public.app_deleted_records_status() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE scheduled BOOLEAN:=false;
BEGIN
    IF to_regclass('cron.job') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname=$1 AND active AND command=$2)' INTO scheduled
            USING 'dong-a-deleted-records-retention','SELECT public.app_purge_deleted_records()';
    END IF;
    RETURN jsonb_build_object('enabled',true,'retention_years',1,'database_schedule',scheduled,'backend_fallback',true);
END $$;
REVOKE ALL ON FUNCTION public.app_deleted_records_status() FROM PUBLIC;

-- Supabase có thể cấp quyền mặc định trực tiếp cho các vai trò API, không chỉ qua PUBLIC.
DO $$ DECLARE r TEXT; fn TEXT; BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','dong_a_school_scope','dong_a_workspace_scope'] LOOP
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
            FOREACH fn IN ARRAY ARRAY['app_archive_redact(jsonb)','app_capture_deleted_record()','app_install_delete_archives()','app_purge_deleted_records()','app_deleted_records_status()'] LOOP
                EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM %I',fn,r);
            END LOOP;
        END IF;
    END LOOP;
END $$;
