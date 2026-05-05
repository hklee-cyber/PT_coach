import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import NavButtons from "@/components/ui/NavButtons";
import CoachingForm from "@/components/mentor/CoachingForm";
import type { CoachingContent } from "@/types/database";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params;

  // 미들웨어가 주입한 헤더에서 사용자 정보를 읽음
  // → getUser() 및 profiles 중복 조회 제거
  const hdrs = await headers();
  const userId   = hdrs.get("x-user-id") ?? "";
  const userName = decodeURIComponent(hdrs.get("x-user-name") ?? "");

  const supabase = await createClient();

  // 학생 정보 (RLS로 본인 담당만 조회됨)
  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (!student) notFound();

  // 전체 코칭 기록 — 날짜 역순 (최신 → 오래된 순)
  const { data: rawRecords } = await supabase
    .from("coaching_records")
    .select("id, date, content")
    .eq("student_id", id)
    .order("date", { ascending: false });

  const allRecords: { id: string; date: string; content: CoachingContent }[] =
    (rawRecords ?? []) as { id: string; date: string; content: CoachingContent }[];

  // 월별 학습전략보고서 — 서비스 롤로 RLS 우회 조회 (monthly_reports는 admin 전용 RLS)
  const adminClient = createAdminClient();
  const { data: rawReports } = await adminClient
    .from("monthly_reports")
    .select("id, year_month, content")
    .eq("student_id", id)
    .order("year_month", { ascending: false });

  const monthlyReports: { id: string; year_month: string; content: string }[] =
    (rawReports ?? []) as { id: string; year_month: string; content: string }[];

  return (
    <div className="space-y-5">
      {/* 헤더 — 인쇄 시 숨김 */}
      <div className="print:hidden">
        <NavButtons backHref="/mentor" backLabel="학생 목록으로" mainHref="/mentor" mainLabel="메인으로" />
        <div className="flex items-center gap-3 mt-3">
          {student.seat && (
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600 text-sm font-bold border border-blue-100 shrink-0">
              {student.seat}
            </span>
          )}
          <h2 className="text-xl font-bold text-gray-900">{student.name}</h2>
        </div>
        {student.target_university && (
          <p className="text-sm text-gray-500">목표 대학: {student.target_university}</p>
        )}
      </div>

      {/* 코칭 입력 폼 */}
      <CoachingForm
        studentId={student.id}
        mentorId={userId}
        mentorName={userName}
        studentName={student.name}
        targetUniversity={student.target_university ?? null}
        allRecords={allRecords}
        monthlyReports={monthlyReports}
      />
    </div>
  );
}
