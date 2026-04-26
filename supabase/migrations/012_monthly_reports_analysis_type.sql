-- ============================================================
-- 012: monthly_reports — analysis_type 컬럼 추가
-- ============================================================
-- 보고서가 어떤 분석 모드로 생성되었는지 기록
--   'monthly'    : 해당 월 코칭 기록만 분석 (당월 집중)
--   'cumulative' : 입학 시점부터 모든 기록 분석 (누적 성장)
-- ============================================================

ALTER TABLE public.monthly_reports
  ADD COLUMN IF NOT EXISTS analysis_type text
    NOT NULL DEFAULT 'monthly'
    CHECK (analysis_type IN ('monthly', 'cumulative'));
