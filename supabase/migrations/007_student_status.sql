-- ============================================================
-- 007: students.status 컬럼 추가 (재원/퇴원 관리)
-- ============================================================
-- 설계 원칙:
--   - 멘토의 [담당 해제]는 student_mentor_relations 행만 삭제 (데이터 보존)
--   - 실제 퇴원 처리는 admin만 가능하며, students.status = 'inactive' 로 기록
--   - coaching_records는 status 변경과 무관하게 영구 보존됨
--     (CASCADE 삭제는 students 테이블 행 자체를 삭제할 때만 발생)
-- ============================================================

-- ── 1. status 컬럼 추가 ──────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive'));

-- 기존 행은 모두 'active' 로 설정됨 (DEFAULT 적용)

-- ── 2. 인덱스 (active 학생 검색 최적화) ─────────────────────
CREATE INDEX IF NOT EXISTS students_status_idx
  ON public.students (status);

-- ── 3. admin 전용: 퇴원 처리 RLS 추가 ───────────────────────
--    UPDATE 정책 (status 변경)은 admin만 허용
--    멘토는 students 행을 직접 수정할 수 없음

-- 기존 UPDATE 정책 정리
DROP POLICY IF EXISTS "students: admin 수정" ON public.students;
DROP POLICY IF EXISTS "students: 멘토 수정"  ON public.students;

-- admin만 students 수정 (퇴원 처리)
CREATE POLICY "students: admin 수정"
  ON public.students FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
