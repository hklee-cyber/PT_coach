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
  console.time(`[mw] ${pathname}`);

  const { supabase, buildResponse } = createMiddlewareClient(request);

  // ── 0. 항상 공개인 경로 ────────────────────────────────────
  if (ALWAYS_PUBLIC.some((p) => pathname.startsWith(p))) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role) {
        console.timeEnd(`[mw] ${pathname}`);
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    console.timeEnd(`[mw] ${pathname}`);
    return buildResponse();
  }

  // ── 1. 유저 인증 확인 ────────────────────────────────────────
  console.time(`[mw:getUser] ${pathname}`);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.timeEnd(`[mw:getUser] ${pathname}`);

  if (!user) {
    if (GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
      console.timeEnd(`[mw] ${pathname}`);
      return buildResponse();
    }
    console.timeEnd(`[mw] ${pathname}`);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 로그인한 유저가 게스트 전용 경로 접근 시 홈으로
  if (GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    console.timeEnd(`[mw] ${pathname}`);
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── 2. 프로필 조회 (role + full_name 한 번에) ────────────────
  // 이 데이터를 request header에 주입해 레이아웃/페이지의 중복 조회를 제거
  console.time(`[mw:profile] ${pathname}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  console.timeEnd(`[mw:profile] ${pathname}`);

  const role = profile?.role;

  // ── 3. role 없음(승인 대기) → /pending ──────────────────────
  if (!role) {
    console.timeEnd(`[mw] ${pathname}`);
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  // ── 4. admin 전용 경로 권한 확인 ────────────────────────────
  if (ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    if (role !== "admin") {
      console.timeEnd(`[mw] ${pathname}`);
      return NextResponse.redirect(new URL("/mentor", request.url));
    }
  }

  console.timeEnd(`[mw] ${pathname}`);

  // ── 5. role·이름을 request header에 주입 ────────────────────
  // 서버 컴포넌트(레이아웃·페이지)에서 headers()로 읽어
  // DB 재조회 없이 사용자 정보를 활용할 수 있음
  return buildResponse({
    "x-user-id":   user.id,
    "x-user-role": role,
    "x-user-name": profile?.full_name ?? "",
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
