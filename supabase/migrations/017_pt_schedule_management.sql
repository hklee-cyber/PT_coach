-- 017_pt_schedule_management.sql
-- 특정 날짜 PT 수업 취소 오버라이드 및 보강 일정 관리 테이블

-- ── pt_schedule_overrides: 특정 날짜 수업 취소 처리 ───────────────────
CREATE TABLE IF NOT EXISTS public.pt_schedule_overrides (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_date date        NOT NULL,
  slot         integer     NOT NULL CHECK (slot BETWEEN 1 AND 6),
  status       text        NOT NULL DEFAULT '취소' CHECK (status IN ('취소')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, session_date, slot)
);

ALTER TABLE public.pt_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_overrides"
  ON public.pt_schedule_overrides
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_pt_override_date_slot
  ON public.pt_schedule_overrides (session_date, slot);

-- ── pt_makeups: 보강 일정 등록 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_makeups (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  mentor_id     uuid        NOT NULL REFERENCES public.profiles(id),
  makeup_date   date        NOT NULL,
  slot          integer     NOT NULL CHECK (slot BETWEEN 1 AND 6),
  original_date date,
  status        text        NOT NULL DEFAULT '대기'
                            CHECK (status IN ('대기', '진행중', '완료', '취소')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pt_makeups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_makeups"
  ON public.pt_makeups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_pt_makeups_date_slot
  ON public.pt_makeups (makeup_date, slot);
