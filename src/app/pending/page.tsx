"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function PendingPage() {
  const supabase = createClient();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
      <div className="w-full max-w-[600px] bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.10)] px-16 py-14 flex flex-col items-center gap-6 text-center">

        <Image
          src="/logo.png"
          alt="뉴퍼센트 스파르타 로고"
          width={260}
          height={80}
          priority
          className="object-contain"
        />

        <div className="w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center mt-4">
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="space-y-2">
          <p className="text-[18px] font-bold text-gray-900">가입 신청이 완료되었습니다.</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            관리자 승인 후 로그인하여 서비스를 이용하실 수 있습니다.<br />
            승인이 완료되면 아래 버튼으로 로그인해주세요.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 mt-2 w-full">
          <a
            href="/login"
            className="w-full py-3.5 rounded-2xl bg-gray-900 text-white text-sm font-bold text-center hover:bg-gray-800 transition"
          >
            로그인 페이지로 이동
          </a>

          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 transition"
            >
              현재 세션 로그아웃
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
