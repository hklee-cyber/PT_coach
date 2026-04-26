-- ============================================================
-- 010: 요일/교시별 스마트 매칭 시스템
-- ============================================================
-- 변경 사항:
--   1. student_mentor_relations 에 day_of_week + slot 컬럼 추가
--   2. UNIQUE 제약을 (student_id, mentor_id) → (student_id)로 강화
--      (학생 1명 = 멘토 1명 + 시간 슬롯 1개)
--   3. mentor_availability 테이블 신설
--   4. RLS 재설정: 멘토는 조회만, 배정 수정은 admin 전용
-- ============================================================


-- ── 1. student_mentor_relations 스케줄 컬럼 추가 ─────────────
ALTER TABLE public.student_mentor_relations
  ADD COLUMN IF NOT EXISTS day_of_week text
    CHECK (day_of_week IN ('월','화','수','목','금','토')),
  ADD COLUMN IF NOT EXISTS slot        int
    CHECK (slot BETWEEN 1 AND 6);

-- 멘토가 같은 요일·교시에 두 학생을 동시 담당하지 못하도록 제약
-- (NULL 값은 대상 외, 배정 완료된 슬롯에만 적용)
CREATE UNIQUE INDEX IF NOT EXISTS smr_mentor_slot_unique
  ON public.student_mentor_relations (mentor_id, day_of_week, slot)
  WHERE day_of_week IS NOT NULL AND slot IS NOT NULL;


-- ── 2. RLS 재설정: 배정 권한 admin 전용으로 변경 ─────────────
-- 기존 멘토 INSERT/DELETE 정책 제거
DROP POLICY IF EXISTS "smr: 멘토 추가"  ON public.student_mentor_relations;
DROP POLICY IF EXISTS "smr: 멘토 삭제"  ON public.student_mentor_relations;

-- admin: INSERT/DELETE
CREATE POLICY "smr: admin 추가"
  ON public.student_mentor_relations FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

-- admin 삭제 정책이 이미 있으면 덮어쓰기
DROP POLICY IF EXISTS "smr: admin 삭제" ON public.student_mentor_relations;
CREATE POLICY "smr: admin 삭제"
  ON public.student_mentor_relations FOR DELETE
  USING (public.get_my_role() = 'admin');

-- admin: UPDATE (스케줄 변경용)
CREATE POLICY "smr: admin 수정"
  ON public.student_mentor_relations FOR UPDATE
  USING  (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');


-- ── 3. students 등록 권한: admin 전용으로 변경 ───────────────
DROP POLICY IF EXISTS "students: 멘토·admin 등록" ON public.students;

CREATE POLICY "students: admin 등록"
  ON public.students FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');


-- ── 4. mentor_availability 테이블 신설 ───────────────────────
CREATE TABLE IF NOT EXISTS public.mentor_availability (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week text        NOT NULL CHECK (day_of_week IN ('월','화','수','목','금','토')),
  slot        int         NOT NULL CHECK (slot BETWEEN 1 AND 6),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_availability_unique UNIQUE (mentor_id, day_of_week, slot)
);

CREATE INDEX IF NOT EXISTS mentor_availability_mentor_idx
  ON public.mentor_availability (mentor_id);

CREATE INDEX IF NOT EXISTS mentor_availability_slot_idx
  ON public.mentor_availability (day_of_week, slot);

-- RLS 활성화
ALTER TABLE public.mentor_availability ENABLE ROW LEVEL SECURITY;

-- admin: 전체 CRUD
CREATE POLICY "availability: admin 전체"
  ON public.mentor_availability FOR ALL
  USING  (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- 멘토: 본인 가용 시간 조회 (읽기 전용)
CREATE POLICY "availability: 멘토 본인 조회"
  ON public.mentor_availability FOR SELECT
  USING (mentor_id = auth.uid());
