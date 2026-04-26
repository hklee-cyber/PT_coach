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
 * 서버 측 회원가입 처리.
 * - admin API로 유저 생성 → 자동 세션 없음, 이메일 인증 불필요
 * - service role로 profiles 행 강제 upsert → RLS 우회, role=null 확정
 * - 트리거가 role='mentor'를 넣더라도 이 함수가 반드시 null로 덮어씀
 */
export async function signUpUser(
  fullName: string,
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const admin = getAdminClient();

  // 서버 측 길이 검증 (클라이언트 우회 방어)
  if (password.length !== 6) {
    return { error: "비밀번호는 정확히 6자리로 설정해 주세요." };
  }

  // 1. auth.users에 유저 생성
  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    console.error("[sign-up] createUser 실패:", createError.message, createError);
    if (
      createError.message.includes("already been registered") ||
      createError.message.includes("already exists")
    ) {
      return { error: "이미 가입된 이메일입니다." };
    }
    return { error: `가입 중 오류가 발생했습니다: ${createError.message}` };
  }

  console.log("[sign-up] 유저 생성 성공:", data.user.id);

  // 2. profiles 행 강제 upsert
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { id: data.user.id, full_name: fullName, role: null },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("[sign-up] profiles upsert 실패:", profileError.message, profileError);
    // 프로필 저장 실패 시 생성된 auth 유저도 롤백
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: `계정 생성 중 오류가 발생했습니다: ${profileError.message}` };
  }

  console.log("[sign-up] profiles 저장 성공 (role=null)");
  return { error: null };
}
