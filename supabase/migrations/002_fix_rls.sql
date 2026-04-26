-- ============================================================
-- RLS 정책 전면 재설정
-- 문제: profiles 정책이 자기 자신을 재귀 조회하여 admin 역할 확인 불가
-- 해결: SECURITY DEFINER 헬퍼 함수로 재귀 없이 역할 조회
-- ============================================================

-- ── 헬퍼 함수: 현재 로그인 사용자의 role 반환 ──────────────
-- SECURITY DEFINER + search_path 고정으로 RLS 우회하여 안전하게 조회
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ── 기존 정책 전체 삭제 ─────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "profiles: 본인 조회" ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin 전체 조회" ON public.profiles;
DROP POLICY IF EXISTS "profiles: 본인 수정" ON public.profiles;

-- students
DROP POLICY IF EXISTS "students: 멘토 본인 담당 조회" ON public.students;
DROP POLICY IF EXISTS "students: admin 전체 조회" ON public.students;
DROP POLICY IF EXISTS "students: 멘토 추가" ON public.students;
DROP POLICY IF EXISTS "students: 멘토 삭제" ON public.students;
DROP POLICY IF EXISTS "students: admin 삭제" ON public.students;

-- pt_logs
DROP POLICY IF EXISTS "pt_logs: 멘토 본인 조회" ON public.pt_logs;
DROP POLICY IF EXISTS "pt_logs: admin 전체 조회" ON public.pt_logs;
DROP POLICY IF EXISTS "pt_logs: 멘토 추가" ON public.pt_logs;
DROP POLICY IF EXISTS "pt_logs: 멘토 수정" ON public.pt_logs;
DROP POLICY IF EXISTS "pt_logs: 멘토 삭제" ON public.pt_logs;


-- ── profiles 정책 재설정 ────────────────────────────────────

-- 본인 프로필 조회 (재귀 없음)
CREATE POLICY "profiles: 본인 조회"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- admin은 모든 프로필 조회 (헬퍼 함수 사용)
CREATE POLICY "profiles: admin 전체 조회"
    ON public.profiles FOR SELECT
    USING (public.get_my_role() = 'admin');

-- 본인 프로필 수정
CREATE POLICY "profiles: 본인 수정"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);


-- ── students 정책 재설정 ────────────────────────────────────

-- 멘토: 담당 학생 조회
CREATE POLICY "students: 멘토 본인 담당 조회"
    ON public.students FOR SELECT
    USING (mentor_id = auth.uid());

-- admin: 전체 학생 조회
CREATE POLICY "students: admin 전체 조회"
    ON public.students FOR SELECT
    USING (public.get_my_role() = 'admin');

-- 멘토: 본인 담당 학생 추가
CREATE POLICY "students: 멘토 추가"
    ON public.students FOR INSERT
    WITH CHECK (mentor_id = auth.uid());

-- admin: 모든 학생 추가 (어떤 멘토에게든 배정 가능)
CREATE POLICY "students: admin 추가"
    ON public.students FOR INSERT
    WITH CHECK (public.get_my_role() = 'admin');

-- 멘토: 본인 담당 학생 수정
CREATE POLICY "students: 멘토 수정"
    ON public.students FOR UPDATE
    USING (mentor_id = auth.uid());

-- 멘토: 본인 담당 학생 삭제
CREATE POLICY "students: 멘토 삭제"
    ON public.students FOR DELETE
    USING (mentor_id = auth.uid());

-- admin: 모든 학생 삭제
CREATE POLICY "students: admin 삭제"
    ON public.students FOR DELETE
    USING (public.get_my_role() = 'admin');


-- ── pt_logs 정책 재설정 ─────────────────────────────────────

-- 멘토: 본인 로그 조회
CREATE POLICY "pt_logs: 멘토 본인 조회"
    ON public.pt_logs FOR SELECT
    USING (mentor_id = auth.uid());

-- admin: 전체 로그 조회
CREATE POLICY "pt_logs: admin 전체 조회"
    ON public.pt_logs FOR SELECT
    USING (public.get_my_role() = 'admin');

-- 멘토: 본인 로그 추가
CREATE POLICY "pt_logs: 멘토 추가"
    ON public.pt_logs FOR INSERT
    WITH CHECK (mentor_id = auth.uid());

-- 멘토: 본인 로그 수정
CREATE POLICY "pt_logs: 멘토 수정"
    ON public.pt_logs FOR UPDATE
    USING (mentor_id = auth.uid());

-- 멘토: 본인 로그 삭제
CREATE POLICY "pt_logs: 멘토 삭제"
    ON public.pt_logs FOR DELETE
    USING (mentor_id = auth.uid());
