import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Header from "@/components/Header";

/**
 * 어드민 레이아웃
 *
 * 미들웨어가 x-user-role / x-user-name 헤더를 주입하므로
 * getUser() + profiles DB 조회를 생략합니다.
 * (미들웨어가 이미 admin 권한 체크 + 리다이렉트를 처리함)
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const role = hdrs.get("x-user-role");
  const userName = hdrs.get("x-user-name") ?? "";

  if (role !== "admin") redirect("/mentor");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={userName} role="admin" />
      <main className="w-[95%] max-w-[1500px] mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
