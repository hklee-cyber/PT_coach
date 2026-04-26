-- ============================================================
-- NIMS PT 코칭 모듈 - 초기 스키마 마이그레이션
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. profiles 테이블
--    Supabase Auth(auth.users)와 1:1 연결되는 사용자 프로필.
--    트리거를 통해 회원가입 시 자동 생성됨.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role        text        NOT NULL CHECK (role IN ('admin', 'mentor')),
    full_name   text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- auth.users 신규 가입 시 profiles 행 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, role, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'mentor'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────
-- 2. students 테이블
--    각 학생은 한 명의 멘토에게 배정됨.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.students (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text        NOT NULL,
    target_university   text,
    mentor_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at          timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- 3. pt_logs 테이블
--    주간 코칭 데이터. data(jsonb)에 과목별 세부 내용 저장.
--
--    data 컬럼 예시 구조:
--    {
--      "korean":  { "strategy": "...", "progress": "...", "test_score": 85 },
--      "math":    { "strategy": "...", "progress": "...", "test_score": 92 },
--      "english": { "strategy": "...", "progress": "...", "test_score": 78 },
--      "inquiry": { "strategy": "...", "progress": "...", "test_score": 88 }
--    }
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_logs (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    mentor_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date        date        NOT NULL DEFAULT CURRENT_DATE,
    data        jsonb       NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 학생별 날짜 기준 정렬 인덱스 (직전 회차 불러오기 최적화)
CREATE INDEX IF NOT EXISTS pt_logs_student_id_date_idx
    ON public.pt_logs (student_id, date DESC);


-- ============================================================
-- RLS (Row Level Security) 정책
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_logs   ENABLE ROW LEVEL SECURITY;

-- ─── profiles ───────────────────────────────

-- 본인 프로필 조회
CREATE POLICY "profiles: 본인 조회"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- admin은 모든 프로필 조회 가능
CREATE POLICY "profiles: admin 전체 조회"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 본인 프로필 수정
CREATE POLICY "profiles: 본인 수정"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);


-- ─── students ───────────────────────────────

-- 담당 멘토 본인 학생 조회
CREATE POLICY "students: 멘토 본인 담당 조회"
    ON public.students FOR SELECT
    USING (mentor_id = auth.uid());

-- admin은 모든 학생 조회 가능
CREATE POLICY "students: admin 전체 조회"
    ON public.students FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 멘토: 본인 담당 학생 추가
CREATE POLICY "students: 멘토 추가"
    ON public.students FOR INSERT
    WITH CHECK (mentor_id = auth.uid());

-- 멘토: 본인 담당 학생 삭제
CREATE POLICY "students: 멘토 삭제"
    ON public.students FOR DELETE
    USING (mentor_id = auth.uid());

-- admin: 모든 학생 삭제
CREATE POLICY "students: admin 삭제"
    ON public.students FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );


-- ─── pt_logs ────────────────────────────────

-- 멘토: 본인이 작성한 로그 조회
CREATE POLICY "pt_logs: 멘토 본인 조회"
    ON public.pt_logs FOR SELECT
    USING (mentor_id = auth.uid());

-- admin: 모든 로그 조회
CREATE POLICY "pt_logs: admin 전체 조회"
    ON public.pt_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

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
