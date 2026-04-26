import { createClient } from "@/lib/supabase/server";
import NavButtons from "@/components/ui/NavButtons";
import ReportCenter from "@/components/admin/ReportCenter";

export interface StudentReportRow {
  id: string;
  name: string;
  target_university: string | null;
  mentor_name: string | null;
  mentor_id: string | null;
  this_month_records: number;
  report_content: string | null;
}

interface SearchParams { year?: string; month?: string; }

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();

  // 조회 연/월 결정 (쿼리 파라미터 우선, 없으면 현재 월)
  const now = new Date();
  const selectedYear  = Number(searchParams.year)  || now.getFullYear();
  const selectedMonth = Number(searchParams.month) || (now.getMonth() + 1);

  const yearMonth  = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const monthLabel = `${selectedYear}년 ${selectedMonth}월`;

  // 재원 중인 학생 전체
  const { data: students } = await supabase
    .from("students")
    .select("id, name, target_university")
    .eq("status", "active")
    .order("name");

  // 멘토 배정 정보
  const { data: relations } = await supabase
    .from("student_mentor_relations")
    .select("student_id, mentor_id");

  const mentorIds = Array.from(new Set((relations ?? []).map((r) => r.mentor_id)));
  let mentorNameMap: Record<string, string> = {};
  if (mentorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", mentorIds);
    (profiles ?? []).forEach((p) => {
      mentorNameMap[p.id] = p.full_name ?? "—";
    });
  }
  const studentMentorMap: Record<string, { mentor_id: string; mentor_name: string }> = {};
  (relations ?? []).forEach((r) => {
    studentMentorMap[r.student_id] = {
      mentor_id: r.mentor_id,
      mentor_name: mentorNameMap[r.mentor_id] ?? "—",
    };
  });

  // 선택 월의 코칭 기록 수 (student_id별 집계)
  const monthStart = `${yearMonth}-01`;
  const lastDay    = new Date(selectedYear, selectedMonth, 0).getDate();
  const monthEnd   = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;

  const { data: recordRows } = await supabase
    .from("coaching_records")
    .select("student_id")
    .gte("date", monthStart)
    .lte("date", monthEnd);

  const recordCountMap: Record<string, number> = {};
  (recordRows ?? []).forEach((r) => {
    recordCountMap[r.student_id] = (recordCountMap[r.student_id] ?? 0) + 1;
  });

  // 선택 월의 기존 보고서 조회
  const studentIds = (students ?? []).map((s) => s.id);
  let reportMap: Record<string, string> = {};
  if (studentIds.length > 0) {
    const { data: reports } = await supabase
      .from("monthly_reports")
      .select("student_id, content")
      .in("student_id", studentIds)
      .eq("year_month", yearMonth);
    (reports ?? []).forEach((r) => {
      reportMap[r.student_id] = r.content;
    });
  }

  // 최종 데이터 조합
  const rows: StudentReportRow[] = (students ?? []).map((s) => ({
    id:                 s.id,
    name:               s.name,
    target_university:  s.target_university,
    mentor_name:        studentMentorMap[s.id]?.mentor_name ?? null,
    mentor_id:          studentMentorMap[s.id]?.mentor_id ?? null,
    this_month_records: recordCountMap[s.id] ?? 0,
    report_content:     reportMap[s.id] ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <NavButtons backHref="/admin" backLabel="이전으로" mainHref="/admin" mainLabel="메인으로" />
        <h2 className="text-xl font-bold text-gray-900 mt-2">보고서 관리 센터</h2>
        <p className="text-sm text-gray-500">월간 AI 보고서를 생성·관리합니다.</p>
      </div>

      <ReportCenter
        students={rows}
        yearMonth={yearMonth}
        monthLabel={monthLabel}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />
    </div>
  );
}
