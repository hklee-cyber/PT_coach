"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CoachingRecord, SubjectContent, InquirySubjectContent } from "@/types/database";

export type AnalysisType = "monthly" | "cumulative";

// ── 과목 레이블 ──────────────────────────────────────────────
const SUBJECT_LABELS: Record<string, string> = {
  korean:   "국어",
  math:     "수학",
  english:  "영어",
  inquiry1: "탐구1",
  inquiry2: "탐구2",
};

function formatSubject(label: string, data: SubjectContent | InquirySubjectContent): string {
  const name =
    "subject_name" in data && data.subject_name
      ? `${label}(${data.subject_name})`
      : label;

  const parts = [
    data.grade_goal     && `등급목표: ${data.grade_goal}`,
    data.materials      && `교재/인강: ${data.materials}`,
    data.study_strategy && `공부전략: ${data.study_strategy}`,
    data.planner_check  && `순공시간/플래너: ${data.planner_check}`,
    data.last_progress  && `학습진도: ${data.last_progress}`,
    data.review_habits  && `복습&습관: ${data.review_habits}`,
    data.self_check     && `자기점검(모의/테스트): ${data.self_check}`,
    data.next_plan      && `다음주계획: ${data.next_plan}`,
    data.focus_training && `집중훈련: ${data.focus_training}`,
  ].filter(Boolean);

  if (parts.length === 0) return `  [${name}] 기록 없음`;
  return `  [${name}]\n  - ${parts.join("\n  - ")}`;
}

function formatRecord(rec: CoachingRecord, idx: number): string {
  const { content } = rec;
  const subjectText = (["korean", "math", "english", "inquiry1", "inquiry2"] as const)
    .map((key) => formatSubject(SUBJECT_LABELS[key], content[key]))
    .join("\n");
  return `--- ${idx + 1}회차 (${rec.date}) | 입시: ${content.admission_type || "미정"} | 성적: ${content.grade || "미입력"} ---\n${subjectText}`;
}

// ── 당월 집중 분석 프롬프트 ──────────────────────────────────
function buildMonthlyPrompt(
  studentName: string,
  targetUniversity: string | null,
  yearMonth: string,
  records: CoachingRecord[]
): string {
  const [year, month] = yearMonth.split("-");
  const monthLabel = `${year}년 ${parseInt(month)}월`;
  const nextMonth  = parseInt(month) === 12
    ? `${parseInt(year) + 1}년 1월`
    : `${year}년 ${parseInt(month) + 1}월`;

  const recordSummary = records.map(formatRecord).join("\n\n");

  return `
아래는 ${studentName} 학생의 ${monthLabel} 주간 PT 코칭 기록 전문(全文)입니다.
이를 토대로 **학부모 전달용 월간 학습전략 보고서**를 작성하세요.

[학생 정보]
- 이름: ${studentName}
- 목표 대학: ${targetUniversity ?? "미정"}
- 이번 달 코칭 횟수: ${records.length}회

[${monthLabel} 코칭 기록 원문]
${recordSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[보고서 작성 지침]

▶ 데이터 해석 원칙 (반드시 준수)
- 단순 사실 나열 금지. 반드시 전문가적 해석으로 변환하세요.
  예시) "현우진 뉴런을 들었음" → "수학적 사고 도구를 체계적으로 정립하기 위해 검증된 커리큘럼(뉴런)을 성실히 이행하며, 고난도 문항에 대한 적응력을 꾸준히 축적하고 있음"
- 과목별 목표 등급과 현재 수준의 간극을 분석하여 전략적 조언을 포함하세요.
- 기록에 없는 내용은 추측하지 말고, 기록된 데이터만으로 통찰을 도출하세요.

▶ 어조 원칙
- 학부모: 안심·신뢰를 주는 따뜻하고 권위 있는 전문가 어조
- 학생: 명확한 방향성과 동기부여를 주는 단호하고 구체적인 어조
- 전체 어조: 따뜻하지만 단호함. 과장된 칭찬이나 근거 없는 위로 금지.

▶ 출력 형식 — 반드시 아래 5개 섹션만 순서대로 작성 (섹션 제목 그대로 사용)

## Monthly Focus: 이달의 핵심 변화
(이번 달 코칭 기록에서 가장 두드러진 변화 1~2가지를 한 문단으로 서술. 순공 시간 안정화, 특정 과목 몰입도 상승, 학습 태도 변화 등을 구체적 근거와 함께.)

## Subject Strategy: 과목별 심층 전략
(국어 / 수학 / 영어 / 탐구 순으로 각 과목별 3~5줄씩 분석.
 - 사용 중인 인강·교재의 진행 상황을 전문가 시각으로 해석
 - 기록에 나타난 약점과 그에 대한 구체적 해결책 제시
 - 목표 등급 달성을 위한 현실적 조언 포함)

## Mock-Test Analysis: 모의고사 실전 분석
(기록에 모의고사(이감, 상상, 더프, 수능완성 등) 관련 내용이 있으면 분석.
 점수보다 오답 분석 태도·실전 감각·시간 관리 측면에서 피드백.
 기록이 없으면 "이번 달 모의고사 기록 없음 — 자체 시뮬레이션 권장" 형태로 짧게 서술.)

## Habit & Discipline: 자기주도학습 역량 평가
(플래너·순공 시간·기상 시간 등 루틴 데이터를 바탕으로 자기주도학습의 질을 평가.
 강점은 강화 방향을, 취약점은 개선 방안을 구체적으로 제시.)

## Next Month Road-map: ${nextMonth} 집중 전략
(다음 달 반드시 집중해야 할 과목·영역·훈련을 3~5가지 구체적 행동 계획으로 제시.
 수능 일정(6월 모평 등)이나 해당 시기 중요 이슈와 연결하여 시의성 있게 작성.
 킬러 문항 정복 전략, 시간 배분 훈련, 약점 보완 계획 등 실행 가능한 로드맵 중심.)

- 마크다운 형식 유지 (##, **, -, > 등 자유 활용)
- 각 섹션은 해당 지침 분량 준수
- 보고서 최상단에 "**[${monthLabel} 학습전략 보고서] ${studentName} 학생**" 제목 한 줄 추가
`.trim();
}

// ── 누적 성장 분석 프롬프트 ─────────────────────────────────
function buildCumulativePrompt(
  studentName: string,
  targetUniversity: string | null,
  yearMonth: string,
  allRecords: CoachingRecord[]
): string {
  const [year, month] = yearMonth.split("-");
  const reportMonthLabel = `${year}년 ${parseInt(month)}월`;
  const nextMonth = parseInt(month) === 12
    ? `${parseInt(year) + 1}년 1월`
    : `${year}년 ${parseInt(month) + 1}월`;

  const firstDate  = allRecords[0]?.date ?? "";
  const lastDate   = allRecords[allRecords.length - 1]?.date ?? "";
  const rangeLabel = firstDate ? `${firstDate} ~ ${lastDate}` : "전체";

  // 초기(첫 2회) vs 최근(마지막 2회) 데이터 분리하여 명시
  const earlyRecords  = allRecords.slice(0, Math.min(2, allRecords.length));
  const recentRecords = allRecords.slice(Math.max(0, allRecords.length - 2));
  const middleRecords = allRecords.slice(
    Math.min(2, allRecords.length),
    Math.max(2, allRecords.length - 2)
  );

  const earlyText  = earlyRecords.map(formatRecord).join("\n\n");
  const recentText = recentRecords.map(formatRecord).join("\n\n");
  const middleText = middleRecords.length > 0
    ? middleRecords.map(formatRecord).join("\n\n")
    : "(없음)";

  return `
아래는 ${studentName} 학생의 전체 PT 코칭 기록(${rangeLabel}, 총 ${allRecords.length}회)입니다.
이를 토대로 **학부모 전달용 누적 성장 분석 보고서** (${reportMonthLabel} 기준)를 작성하세요.

[학생 정보]
- 이름: ${studentName}
- 목표 대학: ${targetUniversity ?? "미정"}
- 분석 기간: ${rangeLabel} (총 ${allRecords.length}회)

[초기 코칭 기록 — 시작 시점 기준선]
${earlyText}

[중기 코칭 기록]
${middleText}

[최근 코칭 기록 — 현재 수준]
${recentText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[보고서 작성 지침]

▶ 데이터 해석 원칙 (반드시 준수)
- 단순 사실 나열 금지. 반드시 전문가적 해석으로 변환하세요.
  예시) "현우진 뉴런을 들었음" → "수학적 사고 도구를 체계적으로 정립하기 위해 검증된 커리큘럼(뉴런)을 성실히 이행하며, 고난도 문항에 대한 적응력을 꾸준히 축적하고 있음"
- 초기 기록과 최근 기록을 반드시 비교하여 '변화의 서사'를 구성하세요.
- 과목별 목표 등급과 현재 수준의 간극, 그리고 그 간극이 코칭 기간 동안 어떻게 좁혀졌는지(또는 과제로 남아 있는지)를 분석하세요.
- 기록에 없는 내용은 추측하지 말고, 기록된 데이터만으로 통찰을 도출하세요.

▶ 어조 원칙
- 학부모: 안심·신뢰를 주는 따뜻하고 권위 있는 전문가 어조
- 학생: 명확한 방향성과 동기부여를 주는 단호하고 구체적인 어조
- 전체: 따뜻하지만 단호함. 과장된 칭찬이나 근거 없는 위로 금지.

▶ 출력 형식 — 반드시 아래 5개 섹션만 순서대로 작성 (섹션 제목 그대로 사용)

## Monthly Focus: 코칭 기간 핵심 변화 요약
(${rangeLabel} 기간 중 가장 인상적인 변화 또는 성장 포인트를 한 문단으로 서술. 초기 대비 현재의 달라진 점을 구체적 근거와 함께.)

## Subject Strategy: 과목별 성장 궤적 & 현재 전략
(국어 / 수학 / 영어 / 탐구 순으로 각 과목별 분석.
 - 코칭 초기 → 현재까지의 커리큘럼·전략 변화를 전문가 시각으로 해석
 - 현재 진행 중인 인강·교재의 적절성 평가 및 심화 방향 제시
 - 목표 등급 달성을 위한 잔여 과제와 해결책 포함)

## Mock-Test Analysis: 실전 역량 성장 분석
(코칭 기간 전체 모의고사 기록의 흐름 분석.
 점수 변화보다 '오답 분석 태도의 성숙도'와 '실전 감각 성장' 측면에서 서술.
 기록이 없으면 "모의고사 기록 없음 — 향후 정기 시뮬레이션 도입 권장" 형태로 짧게 서술.)

## Habit & Discipline: 자기주도학습 역량 성장 평가
(플래너·순공 시간·루틴 데이터의 변화를 초기 대비 현재 기준으로 평가.
 학습 규율이 강화된 부분과 아직 보완이 필요한 부분을 균형 있게 서술.)

## Next Month Road-map: ${nextMonth} 집중 전략 & 수능까지 로드맵
(현재까지의 성장 흐름을 가속하기 위해 다음 달 반드시 실행해야 할 3~5가지 구체적 행동 계획.
 수능 일정(6월 모평 등)이나 해당 시기 이슈와 연결하여 단기·중기 로드맵 제시.
 목표 대학 합격을 위한 현실적이고 실행 가능한 전략 중심.)

- 마크다운 형식 유지 (##, **, -, > 등 자유 활용)
- 각 섹션은 해당 지침 분량 준수
- 보고서 최상단에 "**[누적 성장 분석 보고서 | ${reportMonthLabel} 기준] ${studentName} 학생**" 제목 한 줄 추가
`.trim();
}

// ── 시스템 프롬프트 ──────────────────────────────────────────
const SYSTEM_PROMPT_MONTHLY = `
당신은 대한민국 최상위 대입 전문 학습 전략가이자 베테랑 코칭 컨설턴트입니다.

[페르소나]
- 수천 명의 상위권 수험생을 직접 지도하며 SKY·의학계열 합격자를 다수 배출한 전문가
- 수능 출제 경향과 주요 강사 커리큘럼(현우진, 김승리, 이지영, 박봄, 강민철 등)에 정통
- 학생 한 명의 기록만으로 학습 패턴·심리 상태·전략적 허점을 꿰뚫어 보는 분석 능력 보유

[핵심 역할]
1. 주간 PT 코칭 기록(인강·교재·순공시간·플래너·모의고사·복습 패턴)을 수험 전문가의 눈으로 해석
2. 단순 나열이 아닌 전문가적 통찰로 변환 (예: "현우진 뉴런을 들었음" → "수학적 사고 도구를 체계적으로 정립하기 위해 검증된 뉴런 커리큘럼을 이행하며 고난도 문항 적응력을 축적하는 단계")
3. 목표 등급과 현재 수준의 간극을 냉철하게 분석하고 실행 가능한 해결책 제시
4. 학부모에게는 신뢰·안심을, 학생에게는 명확한 방향성과 동기부여를 동시에 제공

[어조 원칙]
- 따뜻하지만 단호한 전문가 어조 유지
- 근거 없는 과장 칭찬·막연한 위로 금지
- 구체적 데이터를 근거로 서술하며, 추측성 발언 금지
- 마크다운(##, **, -, >) 형식을 적극 활용하여 가독성 확보
`.trim();

const SYSTEM_PROMPT_CUMULATIVE = `
당신은 대한민국 최상위 대입 전문 학습 전략가이자 베테랑 코칭 컨설턴트입니다.

[페르소나]
- 수천 명의 상위권 수험생을 직접 지도하며 SKY·의학계열 합격자를 다수 배출한 전문가
- 수능 출제 경향과 주요 강사 커리큘럼(현우진, 김승리, 이지영, 박봄, 강민철 등)에 정통
- 수개월에 걸친 코칭 기록만으로 학생의 성장 궤적·학습 패턴 변화·잠재 역량을 분석하는 능력 보유

[핵심 역할]
1. 코칭 초기부터 현재까지 전체 기록을 시계열로 분석하여 '성장 서사(growth narrative)' 구성
2. 단순 나열이 아닌 전문가적 통찰로 변환 — 변화의 원인과 의미를 해석
3. 목표 등급·목표 대학 합격까지 잔여 과제와 전략적 로드맵 제시
4. 학부모에게는 신뢰·안심을, 학생에게는 명확한 방향성과 동기부여를 동시에 제공

[어조 원칙]
- 따뜻하지만 단호한 전문가 어조 유지
- 과거와 현재를 비교하는 '성장 서사' 중심으로 서술 (단순 현황 나열 금지)
- 구체적 데이터를 근거로 서술하며, 추측성 발언 금지
- 마크다운(##, **, -, >) 형식을 적극 활용하여 가독성 확보
`.trim();

// ── 학생 코칭 기록 조회 ─────────────────────────────────────
export async function getStudentCoachingRecords(
  studentId: string
): Promise<CoachingRecord[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("coaching_records")
    .select("*")
    .eq("student_id", studentId)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CoachingRecord[];
}

// ── 생성 + 자동 저장 ────────────────────────────────────────
export async function generateAndSaveMonthlyReport(
  studentId: string,
  yearMonth: string,
  analysisType: AnalysisType = "monthly"
): Promise<string> {
  const supabase = await createClient();

  // admin 검증
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("관리자만 보고서를 생성할 수 있습니다.");

  // 학생 정보
  const { data: student } = await supabase
    .from("students")
    .select("name, target_university")
    .eq("id", studentId)
    .single();
  if (!student) throw new Error("학생 정보를 불러올 수 없습니다.");

  let records: CoachingRecord[];
  let prompt: string;
  let systemPrompt: string;

  if (analysisType === "cumulative") {
    // 누적 성장 분석: 전체 기록 (시간 순)
    const { data, error } = await supabase
      .from("coaching_records")
      .select("*")
      .eq("student_id", studentId)
      .order("date", { ascending: true });

    if (error) throw new Error(error.message);
    records = (data ?? []) as CoachingRecord[];

    if (records.length === 0)
      throw new Error("저장된 코칭 기록이 없어 보고서를 생성할 수 없습니다.");

    prompt       = buildCumulativePrompt(student.name, student.target_university, yearMonth, records);
    systemPrompt = SYSTEM_PROMPT_CUMULATIVE;
  } else {
    // 당월 집중 분석: 해당 월 기록만
    const [year, month] = yearMonth.split("-").map(Number);
    const lastDay  = new Date(year, month, 0).getDate();
    const monthEnd = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("coaching_records")
      .select("*")
      .eq("student_id", studentId)
      .gte("date", `${yearMonth}-01`)
      .lte("date", monthEnd)
      .order("date", { ascending: true });

    if (error) throw new Error(error.message);
    records = (data ?? []) as CoachingRecord[];

    if (records.length === 0)
      throw new Error(`${yearMonth} 코칭 기록이 없어 보고서를 생성할 수 없습니다.`);

    prompt       = buildMonthlyPrompt(student.name, student.target_university, yearMonth, records);
    systemPrompt = SYSTEM_PROMPT_MONTHLY;
  }

  // Gemini 호출
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.7 },
  });
  const result = await model.generateContent(prompt);
  const content = result.response.text();

  // DB upsert
  const { error: upsertErr } = await supabase
    .from("monthly_reports")
    .upsert(
      { student_id: studentId, year_month: yearMonth, content, analysis_type: analysisType },
      { onConflict: "student_id,year_month" }
    );
  if (upsertErr) throw new Error(upsertErr.message);

  revalidatePath("/admin/reports");
  return content;
}

// ── 특정 학생의 전체 월별 보고서 목록 조회 ──────────────────
export async function getStudentMonthlyReports(
  studentId: string
): Promise<{ id: string; year_month: string; content: string; created_at: string; analysis_type: "monthly" | "cumulative" }[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // content 핵심 필드만 먼저 조회 — 스키마 캐시 미갱신 시에도 content는 반드시 반환
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("id, year_month, content, created_at")
    .eq("student_id", studentId)
    .order("year_month", { ascending: false });

  if (error) throw new Error(error.message);

  // analysis_type은 별도로 시도 — 캐시 미갱신이면 default 'monthly' 사용
  let typeMap: Record<string, "monthly" | "cumulative"> = {};
  try {
    const { data: typeRows } = await supabase
      .from("monthly_reports")
      .select("id, analysis_type")
      .eq("student_id", studentId);
    (typeRows ?? []).forEach((r: { id: string; analysis_type: string }) => {
      typeMap[r.id] = r.analysis_type === "cumulative" ? "cumulative" : "monthly";
    });
  } catch {
    // analysis_type 컬럼 미존재 시 무시
  }

  return (data ?? []).map((r) => ({
    id:            r.id,
    year_month:    r.year_month,
    content:       r.content ?? "",
    created_at:    r.created_at,
    analysis_type: typeMap[r.id] ?? "monthly",
  }));
}

// ── 편집 후 저장 ────────────────────────────────────────────
export async function saveMonthlyReport(
  studentId: string,
  yearMonth: string,
  content: string
): Promise<void> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("관리자만 보고서를 수정할 수 있습니다.");

  const { error } = await supabase
    .from("monthly_reports")
    .upsert(
      { student_id: studentId, year_month: yearMonth, content },
      { onConflict: "student_id,year_month" }
    );
  if (error) throw new Error(error.message);

  revalidatePath("/admin/reports");
}
