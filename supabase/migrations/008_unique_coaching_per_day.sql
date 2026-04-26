-- ============================================================
-- 008: coaching_records (student_id, date) 유니크 제약 추가
-- 같은 학생·날짜 조합의 레코드가 중복 생성되지 않도록 보장.
-- 이후 saveCoachingRecord 액션은 upsert(ON CONFLICT UPDATE)를 사용.
-- ============================================================

-- 기존 중복 행이 있을 경우 최신(created_at DESC) 것만 남기고 나머지 삭제
DELETE FROM public.coaching_records
WHERE id NOT IN (
  SELECT DISTINCT ON (student_id, date) id
  FROM public.coaching_records
  ORDER BY student_id, date, created_at DESC
);

-- 유니크 제약 추가 (이미 Supabase 대시보드에서 직접 적용된 경우 이 줄은 스킵)
ALTER TABLE public.coaching_records
  ADD CONSTRAINT unique_student_date
  UNIQUE (student_id, date);
