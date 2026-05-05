"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { findEmailByName } from "@/app/actions/auth";

export default function LoginPage() {
  const router  = useRouter();
  const supabase = createClient();

  const [name,     setName]     = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  // 로그아웃 후 클라이언트 사이드 네비게이션으로 돌아왔을 때
  // 브라우저 자동완성이 채워 넣은 값을 React 상태로 덮어씁니다.
  useEffect(() => {
    setName("");
    setPassword("");
    setError(null);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. 이름 → 이메일 변환 (서버 액션)
      const result = await findEmailByName(name);
      if ("error" in result) {
        setError(result.error);
        return;
      }

      // 2. 이메일 + 비밀번호로 Supabase 인증
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });

      if (authError) {
        setError("이름 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
      <div className="w-full max-w-[600px] bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.10)] px-16 py-14 flex flex-col items-center gap-0">

        {/* 로고 */}
        <Image
          src="/logo.png"
          alt="뉴퍼센트 스파르타 로고"
          width={320}
          height={100}
          priority
          className="object-contain"
        />

        {/* 환영 메시지 */}
        <p className="mt-10 mb-9 text-[22px] font-bold text-gray-900 text-center leading-normal tracking-tight whitespace-nowrap">
          NIMS PT 코칭 시스템에 오신 것을 환영합니다.
        </p>

        {/* 폼 */}
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">

          {/* 이름 */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              이름
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="off"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:bg-white transition-all duration-200"
            />
          </div>

          {/* 비밀번호 */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:bg-white transition-all duration-200"
            />
          </div>

          {/* 에러 */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              <p className="text-xs text-red-500 font-medium">{error}</p>
            </div>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-1 rounded-2xl bg-blue-600 text-white text-sm font-bold tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                로그인 중...
              </>
            ) : "로그인하기"}
          </button>
        </form>

        <p className="mt-8 text-xs text-gray-400 text-center">
          계정이 없으신가요? 관리자에게 문의해주세요.
        </p>
      </div>
    </div>
  );
}
