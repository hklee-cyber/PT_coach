-- ============================================================
-- students 테이블에서 mentor_id 분리 → student_mentor_relations 테이블로 이관
-- 목적: 학생이 특정 멘토에 종속되지 않고 독립 엔터티로 관리됨
--       코칭 기록(coaching_records)은 student_id 기반으로 유지
-- ============================================================


-- ── 1. student_mentor_relations 테이블 생성 ─────────────────
CREATE TABLE IF NOT EXISTS public.student_mentor_relations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid        NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  mentor_id  uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, mentor_id)   -- 동일 멘토에게 중복 배정 방지
);


-- ── 2. 기존 students.mentor_id 데이터 이관 ──────────────────
INSERT INTO public.student_mentor_relations (student_id, mentor_id)
SELECT id, mentor_id
FROM public.students
WHERE mentor_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ── 3. students 테이블에서 mentor_id 컬럼 제거 ──────────────
DROP POLICY IF EXISTS "students: 멘토 본인 담당 조회" ON public.students;
DROP POLICY IF EXISTS "students: 멘토 추가" ON public.students;
DROP POLICY IF EXISTS "students: 멘토 수정" ON public.students;
DROP POLICY IF EXISTS "students: 멘토 삭제" ON public.students;

ALTER TABLE public.students DROP COLUMN IF EXISTS mentor_id;


-- ── 4. student_mentor_relations RLS ─────────────────────────
ALTER TABLE public.student_mentor_relations ENABLE ROW LEVEL SECURITY;

-- 멘토: 본인 배정 관계 조회
DROP POLICY IF EXISTS "smr: 멘토 본인 조회" ON public.student_mentor_relations;
DROP POLICY IF EXISTS "smr: admin 전체 조회" ON public.student_mentor_relations;
DROP POLICY IF EXISTS "smr: 멘토 추가" ON public.student_mentor_relations;
DROP POLICY IF EXISTS "smr: 멘토 삭제" ON public.student_mentor_relations;
DROP POLICY IF EXISTS "smr: admin 삭제" ON public.student_mentor_relations;

CREATE POLICY "smr: 멘토 본인 조회"
  ON public.student_mentor_relations FOR SELECT
  USING (mentor_id = auth.uid());

-- admin: 전체 배정 관계 조회
CREATE POLICY "smr: admin 전체 조회"
  ON public.student_mentor_relations FOR SELECT
  USING (public.get_my_role() = 'admin');

-- 멘토: 본인에게 학생 배정 추가
CREATE POLICY "smr: 멘토 추가"
  ON public.student_mentor_relations FOR INSERT
  WITH CHECK (mentor_id = auth.uid());

-- 멘토: 본인 배정 제거
CREATE POLICY "smr: 멘토 삭제"
  ON public.student_mentor_relations FOR DELETE
  USING (mentor_id = auth.uid());

-- admin: 모든 배정 관리
CREATE POLICY "smr: admin 삭제"
  ON public.student_mentor_relations FOR DELETE
  USING (public.get_my_role() = 'admin');


-- ── 5. students RLS 재설정 ───────────────────────────────────
--  mentor_id 기반 정책 → 모든 인증 사용자가 검색 가능하도록 변경
--  (기존 학생 불러오기 검색 기능을 위해 필요)

DROP POLICY IF EXISTS "students: 멘토 본인 담당 조회"   ON public.students;
DROP POLICY IF EXISTS "students: 멘토 추가"             ON public.students;
DROP POLICY IF EXISTS "students: admin 추가"            ON public.students;
DROP POLICY IF EXISTS "students: 멘토 수정"             ON public.students;
DROP POLICY IF EXISTS "students: 멘토 삭제"             ON public.students;
DROP POLICY IF EXISTS "students: 인증 사용자 조회" ON public.students;
DROP POLICY IF EXISTS "students: 멘토·admin 등록" ON public.students;
DROP POLICY IF EXISTS "students: admin 삭제" ON public.students;

-- 인증된 사용자 전체 학생 조회 (검색 기능)
CREATE POLICY "students: 인증 사용자 조회"
  ON public.students FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- mentor/admin: 신규 학생 등록
CREATE POLICY "students: 멘토·admin 등록"
  ON public.students FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('admin', 'mentor')
  );

-- admin만 학생 영구 삭제 가능
-- (멘토는 배정 해제만 가능)
CREATE POLICY "students: admin 삭제"
  ON public.students FOR DELETE
  USING (public.get_my_role() = 'admin');


-- ── 6. coaching_records RLS 재설정 ──────────────────────────
--  기존: mentor_id = auth.uid() → 본인 작성 레코드만 조회
--  변경: 배정된 학생의 모든 레코드 조회 (이전 멘토 기록 포함)

DROP POLICY IF EXISTS "coaching_records: 멘토 본인 조회" ON public.coaching_records;
DROP POLICY IF EXISTS "coaching_records: 멘토 추가"      ON public.coaching_records;
DROP POLICY IF EXISTS "coaching_records: 멘토 담당 학생 조회" ON public.coaching_records;
DROP POLICY IF EXISTS "coaching_records: 멘토 담당 학생 기록 추가" ON public.coaching_records;

-- 멘토: 담당 학생의 모든 코칭 기록 조회 (이전 멘토 기록 포함)
CREATE POLICY "coaching_records: 멘토 담당 학생 조회"
  ON public.coaching_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_mentor_relations smr
      WHERE smr.student_id = coaching_records.student_id
        AND smr.mentor_id  = auth.uid()
    )
  );

-- 멘토: 담당 학생에게 코칭 기록 추가
CREATE POLICY "coaching_records: 멘토 담당 학생 기록 추가"
  ON public.coaching_records FOR INSERT
  WITH CHECK (
    mentor_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.student_mentor_relations smr
      WHERE smr.student_id = coaching_records.student_id
        AND smr.mentor_id  = auth.uid()
    )
  );
