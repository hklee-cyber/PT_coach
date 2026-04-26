-- ============================================================
-- coaching_records 테이블 생성
-- pt_logs를 대체. content(jsonb)에 과목별 전체 항목 저장.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coaching_records (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    mentor_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date        date        NOT NULL DEFAULT CURRENT_DATE,
    content     jsonb       NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 학생별 최신순 정렬 인덱스 (직전 회차 불러오기 최적화)
CREATE INDEX IF NOT EXISTS coaching_records_student_date_idx
    ON public.coaching_records (student_id, date DESC);

-- RLS 활성화
ALTER TABLE public.coaching_records ENABLE ROW LEVEL SECURITY;

-- 멘토: 본인 작성 레코드 조회
CREATE POLICY "coaching_records: 멘토 본인 조회"
    ON public.coaching_records FOR SELECT
    USING (mentor_id = auth.uid());

-- admin: 전체 조회
CREATE POLICY "coaching_records: admin 전체 조회"
    ON public.coaching_records FOR SELECT
    USING (public.get_my_role() = 'admin');

-- 멘토: 추가
CREATE POLICY "coaching_records: 멘토 추가"
    ON public.coaching_records FOR INSERT
    WITH CHECK (mentor_id = auth.uid());

-- 멘토: 수정
CREATE POLICY "coaching_records: 멘토 수정"
    ON public.coaching_records FOR UPDATE
    USING (mentor_id = auth.uid());

-- 멘토: 삭제
CREATE POLICY "coaching_records: 멘토 삭제"
    ON public.coaching_records FOR DELETE
    USING (mentor_id = auth.uid());
