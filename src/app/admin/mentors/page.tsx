import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import NavButtons from "@/components/ui/NavButtons";
import MentorManagementList from "@/components/admin/MentorManagementList";

/** auth.users 에서 created_at 일괄 조회 */
async function getCreatedAtMap(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const idSet = new Set(ids);
  const map: Record<string, string> = {};
  (data?.users ?? []).forEach((u) => {
    if (idSet.has(u.id)) map[u.id] = u.created_at;
  });
  return map;
}

export default async function AdminMentorsListPage() {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // 멘토 목록 — password_plain 포함 (admin RLS로 전체 조회 가능)
  const { data: mentorProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, password_plain")
    .eq("role", "mentor")
    .order("full_name");

  // 승인 대기 목록
  const { data: pendingProfiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .is("role", null);

  // 멘토별 담당 학생 수
  const { data: relations } = await supabase
    .from("student_mentor_relations")
    .select("mentor_id");

  const studentCountMap: Record<string, number> = {};
  (relations ?? []).forEach((r) => {
    studentCountMap[r.mentor_id] = (studentCountMap[r.mentor_id] ?? 0) + 1;
  });

  // 가입일(created_at) 일괄 조회
  const allIds = [
    ...(mentorProfiles ?? []).map((p) => p.id),
    ...(pendingProfiles ?? []).map((p) => p.id),
  ];
  const createdAtMap = await getCreatedAtMap(allIds);

  const mentors = (mentorProfiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    password_plain: (p as unknown as { password_plain: string | null }).password_plain ?? "",
    created_at: createdAtMap[p.id] ?? "",
    studentCount: studentCountMap[p.id] ?? 0,
  }));

  const pendingUsers = (pendingProfiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    created_at: createdAtMap[p.id] ?? "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <NavButtons backHref="/admin" backLabel="이전으로" mainHref="/admin" mainLabel="메인으로" />
        <h2 className="text-xl font-bold text-gray-900 mt-2">멘토 관리</h2>
        <p className="text-sm text-gray-500">멘토 계정 관리 및 가입 신청을 승인합니다.</p>
      </div>
      <MentorManagementList
        mentors={mentors}
        pendingUsers={pendingUsers}
        currentUserId={currentUser?.id ?? ""}
      />
    </div>
  );
}
