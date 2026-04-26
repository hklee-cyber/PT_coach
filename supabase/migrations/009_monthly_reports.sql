-- ============================================================
-- 009: monthly_reports — 월별 AI 보고서 저장 테이블
-- ============================================================
-- 설계:
--   - student_id + year_month 로 유니크 (월 1건)
--   - content: AI 생성 후 관리자가 편집한 최종 텍스트
--   - admin 전용 테이블 (멘토는 접근 불가)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year_month  text        NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),
  content     text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_reports_student_month_key UNIQUE (student_id, year_month)
);

-- 학생별 최신 월 정렬 인덱스
CREATE INDEX IF NOT EXISTS monthly_reports_student_month_idx
  ON public.monthly_reports (student_id, year_month DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER monthly_reports_updated_at
  BEFORE UPDATE ON public.monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS 활성화
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

-- admin 전용 정책
CREATE POLICY "monthly_reports: admin 조회"
  ON public.monthly_reports FOR SELECT
  USING (public.get_my_role() = 'admin');

CREATE POLICY "monthly_reports: admin 추가"
  ON public.monthly_reports FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "monthly_reports: admin 수정"
  ON public.monthly_reports FOR UPDATE
  USING  (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "monthly_reports: admin 삭제"
  ON public.monthly_reports FOR DELETE
  USING (public.get_my_role() = 'admin');
