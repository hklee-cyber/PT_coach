"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/types/database";
import BrandLogo from "@/components/BrandLogo";

interface HeaderProps {
  userName: string;
  role: Role;
}

export default function Header({ userName, role }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isAdmin = role === "admin";
  const onAdminPage = pathname.startsWith("/admin");

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="w-[95%] max-w-[1500px] mx-auto px-4 h-16 flex items-center justify-between">
        {/* 좌측: 로고 + 역할 배지 + 네비게이션 */}
        <div className="flex items-center gap-4">
          <BrandLogo variant="header" />
          <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-100 text-blue-700">
            {isAdmin ? "관리자" : "멘토"}
          </span>

        </div>

        {/* 우측: 사용자명 + 로그아웃 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{userName}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-900 transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
