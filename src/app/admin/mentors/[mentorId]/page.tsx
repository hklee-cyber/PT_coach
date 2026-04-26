import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NavButtons from "@/components/ui/NavButtons";
import MentorAvailabilityEditor from "@/components/admin/MentorAvailabilityEditor";
import type { DayOfWeek } from "@/lib/schedule";

interface Props {
  params: Promise<{ mentorId: string }>;
}

export default async function AdminMentorStudentsPage({ params }: Props) {
  const { mentorId } = await params;
  const supabase = await createClient();

  const { data: mentor } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", mentorId)
    .eq("role", "mentor")
    .single();

  if (!mentor) notFound();

  // ── 가용 시간 조회 ────────────────────────────────────────
  const { data: availRaw } = await supabase
    .from("mentor_availability")
    .select("day_of_week, slot")
    .eq("mentor_id", mentorId);

  const availability = (availRaw ?? []) as { day_of_week: DayOfWeek; slot: number }[];

  // ── 담당 학생 + 스케줄 조회 ───────────────────────────────
  const { data: relations } = await supabase
    .from("student_mentor_relations")
    .select("student_id, day_of_week, slot, created_at")
    .eq("mentor_id", mentorId)
    .order("created_at", { ascending: true });

  const studentIds = (relations ?? []).map((r) => r.student_id).filter(Boolean) as string[];
  let students: { id: string; name: string; target_university: string | null; status: string }[] = [];
  if (studentIds.length > 0) {
    const { data } = await supabase
      .from("students")
      .select("id, name, target_university, status")
      .in("id", studentIds);
    const map = new Map((data ?? []).map((s) => [s.id, s]));
    students = studentIds.map((id) => map.get(id)).filter(Boolean) as typeof students;
  }

  // 가용 시간 에디터에 배정 학생 표시용
  const assignedStudents = (relations ?? [])
    .filter((r) => r.day_of_week && r.slot)
    .map((r) => ({
      day_of_week: r.day_of_week as DayOfWeek,
      slot: r.slot as number,
      student_name: students.find((s) => s.id === r.student_id)?.name ?? "—",
    }));

  // 요일·교시 순 정렬
  const dayOrder: Record<string, number> = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5 };
  const sortedRelations = [...(relations ?? [])].sort((a, b) => {
    const dA = dayOrder[a.day_of_week ?? ""] ?? 99;
    const dB = dayOrder[b.day_of_week ?? ""] ?? 99;
    return dA !== dB ? dA - dB : (a.slot ?? 0) - (b.slot ?? 0);
  });

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <NavButtons backHref="/admin/mentors" backLabel="멘토 목록" mainHref="/admin" mainLabel="메인으로" />
        <h2 className="text-xl font-bold text-gray-900 mt-2">{mentor.full_name} 멘토</h2>
        <p className="text-sm text-gray-500">가용 시간 설정 및 담당 학생 관리</p>
      </div>

      {/* 가용 시간 에디터 */}
      <MentorAvailabilityEditor
        mentorId={mentorId}
        initialAvailable={availability}
        assignedStudents={assignedStudents}
      />

      {/* 담당 학생 목록 */}
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <h3 className="font-bold text-gray-900 text-sm">담당 학생 목록</h3>
          <span className="text-xs text-gray-400">총 {students.length}명</span>
        </div>

        {students.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
            <p className="text-sm text-gray-400">배정된 학생이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">이름</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">목표 대학</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">코칭 시간</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">상태</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400">상세</th>
                </tr>
              </thead>
              <tbody>
                {sortedRelations.map((rel, i) => {
                  const student = students.find((s) => s.id === rel.student_id);
                  if (!student) return null;
                  return (
                    <tr key={student.id} className={`hover:bg-gray-50/60 transition ${i !== sortedRelations.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{student.name}</td>
                      <td className="px-5 py-3.5 text-gray-500">{student.target_university ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3.5">
                        {rel.day_of_week && rel.slot ? (
                          <span className="inline-flex text-xs font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                            {rel.day_of_week}요일 {rel.slot}교시
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">미배정</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {student.status === "inactive"
                          ? <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">퇴원</span>
                          : <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">재원</span>
                        }
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/admin/students/${student.id}`} className="text-xs font-semibold text-blue-500 hover:underline">
                          보고서 →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
