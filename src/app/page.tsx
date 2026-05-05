import { redirect } from "next/navigation";
import { headers } from "next/headers";

/**
 * 루트(/) 접근 시 역할에 따라 적절한 홈으로 분기
 *
 * 미들웨어가 이미 getUser() + profiles 조회를 완료하고
 * x-user-role 헤더에 결과를 주입해 두므로
 * 여기서는 DB 재조회 없이 헤더만 읽습니다.
 */
export default async function RootPage() {
  const hdrs = await headers();
  const role = hdrs.get("x-user-role");

  if (!role) redirect("/login");
  if (role === "admin") redirect("/admin");
  if (role === "mentor") redirect("/mentor");
  redirect("/pending");
}
