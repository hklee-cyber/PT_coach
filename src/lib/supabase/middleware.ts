import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * 미들웨어 전용 Supabase 클라이언트
 *
 * 개선점:
 * - pendingCookies를 클로저로 수집한 뒤, buildResponse() 한 번에 적용
 * - buildResponse(extraHeaders) 로 request header를 주입 가능
 *   → 미들웨어가 수집한 role/full_name을 서버 컴포넌트로 전달
 *   → 레이아웃/페이지의 중복 profiles 조회 제거
 */
export function createMiddlewareClient(request: NextRequest) {
  const pendingCookies: Array<{
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pendingCookies.push(c));
        },
      },
    }
  );

  /**
   * 최종 NextResponse를 생성합니다.
   * @param extraHeaders 서버 컴포넌트에서 읽을 수 있도록 request header에 주입할 값
   */
  function buildResponse(
    extraHeaders?: Record<string, string>
  ): NextResponse {
    const reqHeaders = new Headers(request.headers);
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        reqHeaders.set(k, v);
      }
    }
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    // Supabase 세션 갱신 쿠키를 응답에 복사
    for (const { name, value, options } of pendingCookies) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.cookies.set(name, value, (options ?? {}) as any);
    }
    return res;
  }

  return { supabase, buildResponse };
}
