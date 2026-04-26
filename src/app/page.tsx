import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 루트(/) 접근 시 역할에 따라 적절한 홈으로 분기
export default async function RootPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  } else if (profile?.role === "mentor") {
    redirect("/mentor");
  } else {
    redirect("/pending");
  }
}
