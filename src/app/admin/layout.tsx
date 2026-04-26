import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";

// 미들웨어에서 이미 admin 권한 체크를 하지만,
// 서버 컴포넌트에서도 이중 검증
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/mentor");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={profile.full_name} role="admin" />
      <main className="w-[95%] max-w-[1500px] mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
