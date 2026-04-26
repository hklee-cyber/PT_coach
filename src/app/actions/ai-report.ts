"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import type { CoachingRecord, SubjectContent, InquirySubjectContent } from "@/types/database";

const SUBJECT_LABELS: Record<string, string> = {
  korean: "국어",
  math: "수학",
  english: "영어",
  inquiry1: "탐구1",
  inquiry2: "탐구2",
};

function formatSubject(
  label: string,
  data: SubjectContent | InquirySubjectContent
): string {
  const name = "subject_name" in data && data.subject_name ? `${label}(${data.subject_name})` : label;
  return [
    `  [${name}]`,
    `  - 등급목표: ${data.grade_goal || "미입력"}`,
    `  - 교재/인강: ${data.materials || "미입력"}`,
    `  - 공부전략: ${data.study_strategy || "미입력"}`,
    `  - 지난주 진도: ${data.last_progress || "미입력"}`,
    `  - 복습&습관: ${data.review_habits || "미입력"}`,
    `  - 자기점검: ${data.self_check || "미입력"}`,
    `  - 다음 주 계획: ${data.next_plan || "미입력"}`,
    `  - 집중훈련: ${data.focus_training || "미입력"}`,
  ].join("\n");
}

function buildPrompt(
  studentName: string,
  targetUniversity: string | null,
  records: CoachingRecord[]
): string {
  const recordSummary = records
    .map((rec, idx) => {
      const { content } = rec;
      const subjects = (["korean", "math", "english", "inquiry1", "inquiry2"] as const)
        .map((key) => formatSubject(SUBJECT_LABELS[key], content[key]))
        .join("\n");
      return `=== ${idx + 1}회차 (${rec.date}) | 입시유형: ${content.admission_type || "미정"} | 성적: ${content.grade || "미입력"} ===\n${subjects}`;
    })
    .join("\n\n");

  return `
당신은 입시 전문 코칭 컨설턴트입니다.
아래는 학생의 주간 PT 코칭 기록입니다. 이를 바탕으로 학부모와 학생에게 전달할 AI 전략 보고서를 작성해주세요.

[학생 정보]
- 이름: ${studentName}
- 목표 대학: ${targetUniversity ?? "미정"}
- 총 코칭 회차: ${records.length}회

[코칭 기록]
${recordSummary}

[보고서 작성 지침]
1. **종합 분석**: 전체 코칭 기간의 학생 성장과 변화를 객관적으로 분석하세요.
2. **과목별 현황**: 국어, 수학, 영어, 탐구 각 과목의 현재 상태와 추이를 서술하세요.
3. **핵심 강점**: 학생이 잘 하고 있는 부분을 구체적으로 칭찬하세요.
4. **개선 전략**: 약점을 보완하기 위한 구체적이고 실행 가능한 전략을 제시하세요.
5. **다음 단계 목표**: 앞으로 집중해야 할 2~3가지 핵심 목표를 명시하세요.

보고서는 학부모가 읽기 쉽도록 따뜻하고 전문적인 어조로 작성하며, 마크다운 형식(##, **, - 등)을 사용하세요.
`.trim();
}

export async function generateAiReport(studentId: string): Promise<string> {
  const supabase = await createClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("name, target_university")
    .eq("id", studentId)
    .single();

  if (studentError || !student) throw new Error("학생 정보를 불러올 수 없습니다.");

  const typedStudent = student as { name: string; target_university: string | null };

  const { data: records, error: recordsError } = await supabase
    .from("coaching_records")
    .select("*")
    .eq("student_id", studentId)
    .order("date", { ascending: true })
    .limit(12);

  if (recordsError) throw new Error("코칭 기록을 불러올 수 없습니다.");
  if (!records || records.length === 0) throw new Error("코칭 기록이 없어 보고서를 생성할 수 없습니다.");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  const prompt = buildPrompt(typedStudent.name, typedStudent.target_university, records as CoachingRecord[]);
  const result = await model.generateContent(prompt);
  return result.response.text();
}
