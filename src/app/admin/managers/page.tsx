import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import ManagerList from "@/components/admin/ManagerList";
import NavButtons from "@/components/ui/NavButtons";

async function getAuthMap(ids: string[]): Promise<Record<string, { email: string; created_at: string }>> {
  if (ids.length === 0) return {};
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const idSet = new Set(ids);
  const map: Record<string, { email: string; created_at: string }> = {};
  (data?.users ?? []).forEach((u) => {
    if (idSet.has(u.id)) map[u.id] = { email: u.email ?? "", created_at: u.created_at };
  });
  return map;
}

export default async function AdminManagersPage() {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, password_plain")
    .eq("role", "admin")
    .order("full_name");

  const authMap = await getAuthMap((profiles ?? []).map((p) => p.id));

  const admins = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    password_plain: (p as unknown as { password_plain: string | null }).password_plain ?? "",
    created_at: authMap[p.id]?.created_at ?? "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <NavButtons backHref="/admin" backLabel="이전으로" mainHref="/admin" mainLabel="메인으로" />
        <h2 className="text-xl font-bold text-gray-900 mt-2">관리자 관리</h2>
        <p className="text-sm text-gray-500">관리자 계정을 추가하고 삭제합니다.</p>
      </div>
      <ManagerList admins={admins} currentUserId={currentUser?.id ?? ""} />

    </div>
  );
}
