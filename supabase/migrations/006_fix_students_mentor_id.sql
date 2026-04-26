-- ============================================================
-- 006: students.mentor_id 컬럼 최종 정리
-- ============================================================
-- 목적:
--   005 마이그레이션이 DB에 미적용된 경우에도 안전하게 실행됨.
--   students 테이블에서 mentor_id를 완전히 제거하고,
--   student_mentor_relations 테이블 및 RLS가 올바르게 설정되도록 보장.
-- ============================================================


-- ── 1. student_mentor_relations 테이블 (없으면 생성) ─────────
CREATE TABLE IF NOT EXISTS public.student_mentor_relations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid        NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  mentor_id  uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, mentor_id)
);


-- ── 2. 기존 students.mentor_id 데이터를 relations로 이관 ─────
--    (이미 이관됐거나 컬럼이 없으면 ON CONFLICT / IF EXISTS 로 무시)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'students'
      AND column_name  = 'mentor_id'
  ) THEN
    INSERT INTO public.student_mentor_relations (student_id, mentor_id)
    SELECT id, mentor_id
    FROM public.students
    WHERE mentor_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;


-- ── 3. students.mentor_id 외래키 제약 제거 ───────────────────
--    FK 이름은 PostgreSQL 기본 명명 규칙(students_mentor_id_fkey)으로 시도.
--    다를 경우 시스템 카탈로그에서 동적으로 찾아 제거.
DO $$
DECLARE
  v_constraint text;
BEGIN
  -- 시스템 카탈로그에서 students 테이블의 mentor_id 관련 FK 찾기
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.students'::regclass
    AND contype = 'f'
    AND conkey @> ARRAY[
      (SELECT attnum FROM pg_attribute
       WHERE attrelid = 'public.students'::regclass AND attname = 'mentor_id')
    ]::smallint[];

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.students DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Dropped FK constraint: %', v_constraint;
  END IF;
END;
$$;


-- ── 4. students.mentor_id 컬럼 삭제 ─────────────────────────
ALTER TABLE public.students DROP COLUMN IF EXISTS mentor_id;


-- ── 5. student_mentor_relations RLS (없으면 설정) ────────────
ALTER TABLE public.student_mentor_relations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- 멘토: 본인 배정 조회
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'student_mentor_relations' AND policyname = 'smr: 멘토 본인 조회'
  ) THEN
    CREATE POLICY "smr: 멘토 본인 조회"
      ON public.student_mentor_relations FOR SELECT
      USING (mentor_id = auth.uid());
  END IF;

  -- admin: 전체 조회
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'student_mentor_relations' AND policyname = 'smr: admin 전체 조회'
  ) THEN
    CREATE POLICY "smr: admin 전체 조회"
      ON public.student_mentor_relations FOR SELECT
      USING (public.get_my_role() = 'admin');
  END IF;

  -- 멘토: 배정 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'student_mentor_relations' AND policyname = 'smr: 멘토 추가'
  ) THEN
    CREATE POLICY "smr: 멘토 추가"
      ON public.student_mentor_relations FOR INSERT
      WITH CHECK (mentor_id = auth.uid());
  END IF;

  -- 멘토: 배정 해제
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'student_mentor_relations' AND policyname = 'smr: 멘토 삭제'
  ) THEN
    CREATE POLICY "smr: 멘토 삭제"
      ON public.student_mentor_relations FOR DELETE
      USING (mentor_id = auth.uid());
  END IF;

  -- admin: 전체 배정 관리
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'student_mentor_relations' AND policyname = 'smr: admin 삭제'
  ) THEN
    CREATE POLICY "smr: admin 삭제"
      ON public.student_mentor_relations FOR DELETE
      USING (public.get_my_role() = 'admin');
  END IF;
END;
$$;


-- ── 6. students RLS 재설정 ───────────────────────────────────
--    mentor_id 기반 구 정책 제거 → 새 정책으로 교체

DROP POLICY IF EXISTS "students: 멘토 본인 담당 조회" ON public.students;
DROP POLICY IF EXISTS "students: 멘토 추가"           ON public.students;
DROP POLICY IF EXISTS "students: admin 추가"          ON public.students;
DROP POLICY IF EXISTS "students: 멘토 수정"           ON public.students;
-- "students: 멘토 삭제" 는 001에 정의된 구 정책 (admin 삭제와 구분)
DROP POLICY IF EXISTS "students: 멘토 삭제"           ON public.students;

-- 인증 사용자: 전체 학생 검색 허용
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'students' AND policyname = 'students: 인증 사용자 조회'
  ) THEN
    CREATE POLICY "students: 인증 사용자 조회"
      ON public.students FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'students' AND policyname = 'students: 멘토·admin 등록'
  ) THEN
    CREATE POLICY "students: 멘토·admin 등록"
      ON public.students FOR INSERT
      WITH CHECK (public.get_my_role() IN ('admin', 'mentor'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'students' AND policyname = 'students: admin 삭제'
  ) THEN
    CREATE POLICY "students: admin 삭제"
      ON public.students FOR DELETE
      USING (public.get_my_role() = 'admin');
  END IF;
END;
$$;
