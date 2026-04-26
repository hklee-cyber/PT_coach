-- ============================================================
-- 013: monthly_reports — upsert / update RPC 함수
-- ============================================================
-- PostgREST 스키마 캐시 의존 없이 보고서를 저장하기 위한
-- SECURITY DEFINER 함수. 호출자가 admin 역할인지 검증 후 실행.
-- ============================================================

-- ── 1. upsert_monthly_report ─────────────────────────────────
-- AI 생성 시 content + analysis_type 모두 upsert
CREATE OR REPLACE FUNCTION public.upsert_monthly_report(
  p_student_id    uuid,
  p_year_month    text,
  p_content       text,
  p_analysis_type text DEFAULT 'monthly'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- admin 검증
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION '관리자만 보고서를 생성/수정할 수 있습니다.';
  END IF;

  INSERT INTO public.monthly_reports
    (student_id, year_month, content, analysis_type)
  VALUES
    (p_student_id, p_year_month, p_content, p_analysis_type)
  ON CONFLICT (student_id, year_month)
  DO UPDATE SET
    content       = EXCLUDED.content,
    analysis_type = EXCLUDED.analysis_type,
    updated_at    = now();
END;
$$;

-- ── 2. update_monthly_report_content ────────────────────────
-- 수동 편집 저장 시 content만 갱신 (analysis_type 보존)
CREATE OR REPLACE FUNCTION public.update_monthly_report_content(
  p_student_id uuid,
  p_year_month text,
  p_content    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION '관리자만 보고서를 수정할 수 있습니다.';
  END IF;

  INSERT INTO public.monthly_reports
    (student_id, year_month, content, analysis_type)
  VALUES
    (p_student_id, p_year_month, p_content, 'monthly')
  ON CONFLICT (student_id, year_month)
  DO UPDATE SET
    content    = EXCLUDED.content,
    updated_at = now();
  -- analysis_type은 건드리지 않음
END;
$$;

-- 실행 권한: authenticated 사용자에게만 허용
GRANT EXECUTE ON FUNCTION public.upsert_monthly_report       TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_monthly_report_content TO authenticated;
