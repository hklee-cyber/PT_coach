import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";

export default async function MentorLayout({
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

  // role 없음(승인 대기) → /pending 차단
  if (!profile?.role) redirect("/pending");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={profile.full_name ?? ""} role={profile.role} />
      <main className="w-[95%] max-w-[1500px] mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
