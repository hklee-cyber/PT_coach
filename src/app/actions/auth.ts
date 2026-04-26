"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * 이름(full_name)으로 Supabase auth 이메일 조회.
 * 로그인 화면에서 name + password → email + password 로 변환할 때 사용.
 */
export async function findEmailByName(
  name: string
): Promise<{ email: string } | { error: string }> {
  if (!name.trim()) return { error: "이름을 입력해주세요." };

  const admin = getAdminClient();

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("full_name", name.trim());

  if (profileError) return { error: "계정 조회 중 오류가 발생했습니다." };
  if (!profiles || profiles.length === 0) return { error: "이름 또는 비밀번호가 올바르지 않습니다." };
  if (profiles.length > 1) return { error: "동일한 이름의 계정이 여러 개 존재합니다. 관리자에게 문의하세요." };

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(profiles[0].id);
  if (authError || !authUser.user?.email) return { error: "이름 또는 비밀번호가 올바르지 않습니다." };

  return { email: authUser.user.email };
}
