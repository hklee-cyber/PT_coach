import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Header from "@/components/Header";
import type { Role } from "@/types/database";

/**
 * 멘토 레이아웃
 *
 * 미들웨어가 x-user-role / x-user-name 헤더를 주입하므로
 * getUser() + profiles DB 조회를 생략합니다.
 */
export default async function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const role = hdrs.get("x-user-role") as Role;
  const userName = decodeURIComponent(hdrs.get("x-user-name") ?? "");

  if (!role) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={userName} role={role} />
      <main className="w-[95%] max-w-[1500px] mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
