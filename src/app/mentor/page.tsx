import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TodaySchedule from "@/components/mentor/TodaySchedule";
import PasswordChangeForm from "@/components/mentor/PasswordChangeForm";
import { DAY_INDEX_MAP, type DayOfWeek } from "@/lib/schedule";
import type { Student } from "@/types/database";

export default async function MentorHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  // ── 오늘 요일 (서버 기준) ─────────────────────────────────
  const todayDay = DAY_INDEX_MAP[new Date().getDay()] as DayOfWeek | null;

  // ── 오늘 담당 슬롯 조회 ───────────────────────────────────
  // student_mentor_relations에서 오늘 요일에 배정된 학생 가져오기
  type SlotRow = {
    slot: number;
    student_id: string | null;
    student_name: string | null;
    target_university: string | null;
  };

  let todaySlots: SlotRow[] = [];

  if (todayDay) {
    const { data: relations } = await supabase
      .from("student_mentor_relations")
      .select("slot, student_id")
      .eq("mentor_id", user!.id)
      .eq("day_of_week", todayDay)
      .not("slot", "is", null);

    if (relations && relations.length > 0) {
      const studentIds = relations.map((r) => r.student_id).filter(Boolean) as string[];
      const { data: studentRows } = await supabase
        .from("students")
        .select("id, name, target_university")
        .in("id", studentIds);

      const studentMap = new Map((studentRows ?? []).map((s) => [s.id, s]));
      todaySlots = relations.map((r) => ({
        slot: r.slot as number, // .not("slot", "is", null) ensures non-null
        student_id: r.student_id,
        student_name: studentMap.get(r.student_id!)?.name ?? null,
        target_university: studentMap.get(r.student_id!)?.target_university ?? null,
      }));
    }
  }

  // ── 전체 담당 학생 목록 (읽기 전용) ──────────────────────
  const { data: relations } = await supabase
    .from("student_mentor_relations")
    .select("student_id, day_of_week, slot, created_at")
    .eq("mentor_id", user!.id)
    .order("created_at", { ascending: true });

  let students: (Student & { day_of_week: string | null; slot: number | null })[] = [];
  const assignedIds = (relations ?? []).map((r) => r.student_id).filter(Boolean) as string[];

  if (assignedIds.length > 0) {
    const { data } = await supabase
      .from("students")
      .select("*")
      .in("id", assignedIds);

    const map = new Map((data ?? []).map((s) => [s.id, s]));
    students = assignedIds
      .map((id) => {
        const rel = relations?.find((r) => r.student_id === id);
        const s = map.get(id);
        if (!s) return null;
        return { ...s, day_of_week: rel?.day_of_week ?? null, slot: rel?.slot ?? null };
      })
      .filter(Boolean) as typeof students;
  }

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <p className="text-sm text-gray-400 font-medium mb-1">뉴퍼센트 멘토 대시보드</p>
        <h2 className="text-2xl font-bold text-gray-900">
          {profile?.full_name ?? ""} 멘토님, 안녕하세요
        </h2>
      </div>

      {/* 오늘의 시간표 */}
      <TodaySchedule today={todayDay} slots={todaySlots} />

      {/* 비밀번호 변경 */}
      <PasswordChangeForm mentorName={profile?.full_name ?? ""} />

      {/* 전체 담당 학생 (읽기 전용) */}
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <h3 className="text-base font-bold text-gray-900">전체 담당 학생</h3>
          <span className="text-sm text-gray-400">
            총 <span className="font-semibold text-gray-700">{students.length}</span>명
          </span>
        </div>

        {students.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl px-8 py-10 text-center">
            <p className="text-gray-400 text-sm">배정된 학생이 없습니다.</p>
            <p className="text-gray-300 text-xs mt-1">관리자에게 학생 배정을 요청해주세요.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">이름</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">목표 대학</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400">코칭 시간</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} className={`hover:bg-gray-50/70 transition ${i !== students.length - 1 ? "border-b border-gray-50" : ""}`}>
                    <td className="px-5 py-3.5 text-gray-300 text-xs">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <Link href={`/mentor/students/${s.id}`} className="font-semibold text-gray-900 hover:underline underline-offset-2">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-sm">
                      {s.target_university ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.day_of_week && s.slot ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                          {s.day_of_week}요일 {s.slot}교시
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">미배정</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
