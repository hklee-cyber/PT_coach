"use server";

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * 모듈 수준 싱글톤 어드민 클라이언트
 *
 * Next.js 서버리스 환경에서 핫 리로드(워커 재사용) 사이에
 * 동일 인스턴스를 재사용해 초기화 오버헤드를 줄입니다.
 */
let _adminClient: SupabaseClient<Database> | null = null;

function getAdminClient(): SupabaseClient<Database> {
  if (!_adminClient) {
    _adminClient = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _adminClient;
}

/**
 * 이름(full_name)으로 Supabase auth 이메일 조회.
 * 로그인 화면에서 name + password → email + password 로 변환할 때 사용.
 *
 * 최적화:
 * - 싱글톤 admin 클라이언트로 연결 초기화 오버헤드 제거
 * - console.time 으로 각 구간 측정
 */
export async function findEmailByName(
  name: string
): Promise<{ email: string } | { error: string }> {
  if (!name.trim()) return { error: "이름을 입력해주세요." };

  console.time("[auth:findEmailByName] total");

  const admin = getAdminClient();

  // ── 1단계: profiles 테이블에서 id 조회 ──────────────────────
  console.time("[auth:findEmailByName] profiles lookup");
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("full_name", name.trim());
  console.timeEnd("[auth:findEmailByName] profiles lookup");

  if (profileError) {
    console.timeEnd("[auth:findEmailByName] total");
    return { error: "계정 조회 중 오류가 발생했습니다." };
  }
  if (!profiles || profiles.length === 0) {
    console.timeEnd("[auth:findEmailByName] total");
    return { error: "이름 또는 비밀번호가 올바르지 않습니다." };
  }
  if (profiles.length > 1) {
    console.timeEnd("[auth:findEmailByName] total");
    return { error: "동일한 이름의 계정이 여러 개 존재합니다. 관리자에게 문의하세요." };
  }

  // ── 2단계: auth.admin API로 이메일 조회 ─────────────────────
  console.time("[auth:findEmailByName] getUserById");
  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(
    profiles[0].id
  );
  console.timeEnd("[auth:findEmailByName] getUserById");
  console.timeEnd("[auth:findEmailByName] total");

  if (authError || !authUser.user?.email) {
    return { error: "이름 또는 비밀번호가 올바르지 않습니다." };
  }

  return { email: authUser.user.email };
}
