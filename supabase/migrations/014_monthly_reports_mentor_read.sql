-- ============================================================
-- 014: monthly_reports — 멘토 읽기 권한 추가
-- ============================================================
-- 기존 정책은 admin 전용이라 멘토가 담당 학생의 보고서를
-- 조회할 수 없었음. student_mentor_relations를 통해
-- 본인이 담당한 학생의 보고서만 읽도록 허용.
-- ============================================================

CREATE POLICY "monthly_reports: 담당 멘토 조회"
  ON public.monthly_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.student_mentor_relations smr
      WHERE smr.student_id = monthly_reports.student_id
        AND smr.mentor_id  = auth.uid()
    )
  );
