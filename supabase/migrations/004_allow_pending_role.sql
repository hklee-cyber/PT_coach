-- ============================================================
-- profiles.role : NOT NULL 제거 + CHECK 제약 완화 + 트리거 수정
-- 목적: 가입 시 role=null(승인 대기) 상태 허용
-- ============================================================

-- 1. NOT NULL 제약 제거
ALTER TABLE public.profiles
  ALTER COLUMN role DROP NOT NULL;

-- 2. 기존 CHECK 제약 제거 (role IN ('admin','mentor') → null도 허용해야 함)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 새 CHECK 제약: null 허용, 값이 있을 때만 'admin'|'mentor'만 허용
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IS NULL OR role IN ('admin', 'mentor'));

-- 3. 트리거 함수 수정: 기본값 'mentor' → NULL
--    ON CONFLICT DO NOTHING: 서버 액션의 upsert가 이후에 role=null을 확정함
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
