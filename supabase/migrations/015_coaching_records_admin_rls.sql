-- ============================================================
-- 015: coaching_records 테이블에 admin INSERT/UPDATE/DELETE 정책 추가
--
-- 문제: admin이 워드 파일을 가져올 때 mentor_id = 담당 멘토 ID 로
--       INSERT를 시도하지만, 기존 정책은 mentor_id = auth.uid() 만
--       허용하므로 RLS 위반 에러가 발생.
-- 해결: admin 역할에 대해 INSERT/UPDATE/DELETE를 허용하는 정책 추가.
-- ============================================================

-- admin: 추가
CREATE POLICY "coaching_records: admin 추가"
    ON public.coaching_records FOR INSERT
    WITH CHECK (public.get_my_role() = 'admin');

-- admin: 수정
CREATE POLICY "coaching_records: admin 수정"
    ON public.coaching_records FOR UPDATE
    USING (public.get_my_role() = 'admin');

-- admin: 삭제
CREATE POLICY "coaching_records: admin 삭제"
    ON public.coaching_records FOR DELETE
    USING (public.get_my_role() = 'admin');
