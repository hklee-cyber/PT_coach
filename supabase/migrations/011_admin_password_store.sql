-- profiles 테이블에 평문 비밀번호 보관 컬럼 추가
-- (내부 관리용 — 학원 운영 목적)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_plain TEXT;

-- 관리자 페이지에서 password_plain 읽기/수정 허용 (service role은 RLS 우회)
-- 일반 사용자는 자신의 행에 대해서만 접근 가능하므로 별도 정책 불필요.
