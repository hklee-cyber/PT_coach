"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// service role key를 사용하는 admin 클라이언트 (계정 삭제 등 관리 작업용)
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// 승인: 지정한 role(mentor | admin) 부여
export async function approveUser(userId: string, role: "mentor" | "admin") {
  // ── 1. 호출자가 admin인지 일반 클라이언트로 검증 ──────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: callerProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") throw new Error("Unauthorized");

  // ── 2. service role client로 업데이트 (RLS 우회) ─────
  const admin = getAdminClient();
  const { data: updated, error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("해당 유저를 찾을 수 없거나 이미 처리된 요청입니다.");
  }

  revalidatePath("/admin");
}

// 계정 삭제 공통 로직
async function deleteAccount(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: callerProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") throw new Error("Unauthorized");

  if (user.id === userId) throw new Error("본인 계정은 삭제할 수 없습니다.");

  const adminClient = getAdminClient();
  await adminClient.from("profiles").delete().eq("id", userId);

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

// 가입 거절 (승인 대기 유저)
export async function rejectUser(userId: string) {
  await deleteAccount(userId);
}

// 멘토 계정 삭제 — 담당 학생이 있으면 차단
export async function deleteMentor(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: callerProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") throw new Error("Unauthorized");

  const { count } = await supabase
    .from("student_mentor_relations")
    .select("id", { count: "exact", head: true })
    .eq("mentor_id", userId);

  if ((count ?? 0) > 0) {
    throw new Error("먼저 담당 학생을 모두 해제해야 삭제할 수 있습니다.");
  }

  await deleteAccount(userId);
}

// 관리자 계정 삭제
export async function deleteAdmin(userId: string) {
  await deleteAccount(userId);
}

// 계정 직접 생성 (관리자·멘토 신규 추가, 승인 대기 단계 없음)
// email 파라미터가 없으면 이름 기반 내부 이메일을 자동 생성
export async function createAccountDirect(
  name: string,
  emailOrEmpty: string,
  password: string,
  role: "admin" | "mentor"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: callerProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") throw new Error("Unauthorized");

  if (!name.trim()) throw new Error("이름을 입력해주세요.");
  if (password.length < 4) throw new Error("비밀번호는 4자리 이상이어야 합니다.");

  // 이메일이 없으면 이름을 hex 인코딩하여 내부 이메일 자동 생성
  const email = emailOrEmpty.trim()
    ? emailOrEmpty.trim()
    : `${role}_${Buffer.from(name.trim()).toString("hex")}_${Date.now()}@nims.internal`;

  const adminClient = getAdminClient();

  const { data: created, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name.trim() },
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("already been registered")) {
      throw new Error("이미 사용 중인 이메일입니다.");
    }
    throw new Error(authError.message);
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert({
      id: created.user.id,
      full_name: name.trim(),
      role,
      password_plain: password,
    });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    throw new Error(profileError.message);
  }

  revalidatePath("/admin");
}

// 관리자 정보 수정 (이름, 비밀번호)
export async function updateAdmin(
  targetId: string,
  newName: string,
  newPassword: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: callerProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") throw new Error("Unauthorized");

  if (!newName.trim()) throw new Error("이름을 입력해주세요.");
  if (newPassword.length < 4) throw new Error("비밀번호는 4자리 이상이어야 합니다.");

  const adminClient = getAdminClient();

  // auth 비밀번호 업데이트
  const { error: authErr } = await adminClient.auth.admin.updateUserById(targetId, {
    password: newPassword,
  });
  if (authErr) throw new Error(authErr.message);

  // profiles 이름·비밀번호 업데이트
  const { error: profileErr } = await adminClient
    .from("profiles")
    .update({ full_name: newName.trim(), password_plain: newPassword })
    .eq("id", targetId);
  if (profileErr) throw new Error(profileErr.message);

  revalidatePath("/admin/managers");
}

// 멘토 비밀번호 변경 (admin 전용)
export async function updateMentorPassword(
  targetId: string,
  newPassword: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: callerProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") throw new Error("Unauthorized");

  if (newPassword.length < 4) throw new Error("비밀번호는 4자리 이상이어야 합니다.");

  const adminClient = getAdminClient();

  const { error: authErr } = await adminClient.auth.admin.updateUserById(targetId, {
    password: newPassword,
  });
  if (authErr) throw new Error(authErr.message);

  const { error: profileErr } = await adminClient
    .from("profiles")
    .update({ password_plain: newPassword })
    .eq("id", targetId);
  if (profileErr) throw new Error(profileErr.message);

  revalidatePath("/admin/mentors");
}
