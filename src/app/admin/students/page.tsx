import { unstable_cache } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import NavButtons from "@/components/ui/NavButtons";
import StudentManagementList from "@/components/admin/StudentManagementList";

// ── 캐시 설정: 페이지 레벨 캐시 완전 비활성화 ─────────────────
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// ── 학생+멘토 데이터 조회 (서비스 롤로 RLS 없이, tag 기반 캐시) ─
// unstable_cache로 감싸야 revalidateTag('students-list')가 동작함
const fetchStudentsWithMentors = unstable_cache(
  async () => {
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const [{ data: students }, { data: relations }] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, target_university, status, created_at")
        .order("name"),
      supabase
        .from("student_mentor_relations")
        .select("student_id, mentor_id"),
    ]);

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

    return (students ?? []).map((s) => ({
      ...s,
      status: (s.status ?? "active") as "active" | "inactive",
      mentor_name: studentMentorMap[s.id]?.mentor_name ?? null,
      mentor_id: studentMentorMap[s.id]?.mentor_id ?? null,
    }));
  },
  ["students-list"],           // 캐시 키
  { tags: ["students-list"] }  // revalidateTag 타겟
);

// ── 페이지 ────────────────────────────────────────────────────
export interface StudentWithMentor {
  id: string;
  name: string;
  target_university: string | null;
  status: "active" | "inactive";
  created_at: string;
  mentor_name: string | null;
  mentor_id: string | null;
}

export default async function AdminStudentsListPage() {
  const studentsWithMentor = await fetchStudentsWithMentors();

  return (
    <div className="space-y-6">
      <div>
        <NavButtons backHref="/admin" backLabel="이전으로" mainHref="/admin" mainLabel="메인으로" />
        <h2 className="text-xl font-bold text-gray-900 mt-2">학생 관리</h2>
        <p className="text-sm text-gray-500">전체 학생 목록을 조회하고 관리합니다.</p>
      </div>
      <StudentManagementList students={studentsWithMentor as StudentWithMentor[]} />
    </div>
  );
}
