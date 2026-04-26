import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

// 로그인 여부와 무관하게 항상 접근 가능한 경로
const ALWAYS_PUBLIC = ["/pending"];

// 비로그인 상태에서만 접근 가능한 경로 (로그인 상태면 홈으로)
const GUEST_ONLY_PATHS = ["/login", "/signup"];

// admin 전용 경로 (mentor 접근 불가)
const ADMIN_ONLY_PATHS = ["/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 0. 항상 공개인 경로는 즉시 통과 ─────────────────
  if (ALWAYS_PUBLIC.some((p) => pathname.startsWith(p))) {
    const { supabase, supabaseResponse } = await createMiddlewareClient(request);
    // 세션 쿠키 갱신만 수행하고, role이 있는 승인 유저가 /pending에 오면 홈으로
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return supabaseResponse;
  }

  const { supabase, supabaseResponse } = await createMiddlewareClient(request);

  // 세션 갱신 (중요: getUser()를 반드시 호출해야 쿠키가 최신 상태로 유지됨)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── 1. 비로그인 사용자 처리 ──────────────────────────
  if (!user) {
    if (GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
      return supabaseResponse;
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── 2. 로그인 사용자가 비로그인 전용 경로 접근 시 홈으로 ──
  if (GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── 3. 역할(role) 조회 ───────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  // ── 4. role 없음(승인 대기) → 모든 경로 차단, /pending으로 ──
  if (!role) {
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  // ── 5. admin 전용 경로 접근 권한 확인 ────────────────
  if (ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/mentor", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * 아래 경로를 제외한 모든 요청에 미들웨어 적용:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico, 이미지 파일 등
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
