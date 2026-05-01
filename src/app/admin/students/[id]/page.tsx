import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import StudentStatusButton from "@/components/admin/StudentStatusButton";
import StudentScheduleAssigner from "@/components/admin/StudentScheduleAssigner";
import StudentActionPanel from "@/components/admin/StudentActionPanel";
import NavButtons from "@/components/ui/NavButtons";
import type { DayOfWeek } from "@/lib/schedule";
import type { CoachingContent } from "@/types/database";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminStudentReportPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, name, target_university, status, seat")
    .eq("id", id)
    .single();

  if (!student) notFound();

  // 담당 멘토 + 스케줄 조회
  type RelationWithProfile = { mentor_id: string; day_of_week: string | null; slot: number | null; profiles: { full_name: string } | null };
  const { data: relationRaw } = await supabase
    .from("student_mentor_relations")
    .select("mentor_id, day_of_week, slot, profiles!mentor_id(full_name)")
    .eq("student_id", id)
    .maybeSingle();
  const relation = relationRaw as unknown as RelationWithProfile | null;

  const mentorId   = relation?.mentor_id ?? null;
  const mentorName = relation?.profiles?.full_name ?? "-";
  const dayOfWeek  = relation?.day_of_week as DayOfWeek | null ?? null;
  const slot       = relation?.slot ?? null;

  const currentSchedule = mentorId && dayOfWeek && slot
    ? { mentor_id: mentorId, mentor_name: mentorName, day_of_week: dayOfWeek, slot }
    : null;

  // 코칭 기록 전체 조회 (날짜 역순 — 최신순)
  const { data: rawRecords } = await supabase
    .from("coaching_records")
    .select("id, date, content")
    .eq("student_id", id)
    .order("date", { ascending: false });

  const coachingRecords = (rawRecords ?? []) as { id: string; date: string; content: CoachingContent }[];
  const coachingCount   = coachingRecords.length;

  // 관리자 본인 id (mentorId 없을 때 fallback)
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const importerMentorId = mentorId ?? adminUser?.id ?? "";

  return (
    <div className="min-h-screen bg-slate-50 -mx-4 px-4 pb-16 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 pt-2">
        {/* ── 헤더 ──────────────────────────────────────────────── */}
        <div>
          <NavButtons
            backHref="/admin/students"
            backLabel="학생 목록으로"
            mainHref="/admin"
            mainLabel="메인 대시보드로"
          />
          <div className="flex items-center gap-3 mt-2">
            {(student as { seat?: string | null }).seat && (
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600 text-sm font-bold border border-blue-100 shrink-0">
                {(student as { seat?: string | null }).seat}
              </span>
            )}
            <h2 className="text-xl font-bold text-gray-900">{student.name}</h2>
            {student.target_university && (
              <span className="text-sm text-gray-500">목표: {student.target_university}</span>
            )}
          </div>
          <div className="mt-2">
            <StudentStatusButton
              studentId={id}
              studentName={student.name}
              initialStatus={student.status ?? "active"}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            코칭 기록 {coachingCount}회차 누적
          </p>
        </div>

        {/* ── 1. 코칭 스케줄 배정 ───────────────────────────────── */}
        <StudentScheduleAssigner
          studentId={id}
          studentName={student.name}
          current={currentSchedule}
        />

        {/* ── 2. 액션 패널 (3버튼 + 마일스톤 카드) ─────────────── */}
        <StudentActionPanel
          records={coachingRecords}
          studentId={id}
          studentName={student.name}
          mentorId={importerMentorId}
          mentorName={mentorName}
          targetUniversity={student.target_university ?? null}
        />
      </div>
    </div>
  );
}
