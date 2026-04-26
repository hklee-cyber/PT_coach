/**
 * 뉴퍼센트 스파르타 브랜드 로고 공통 컴포넌트
 * — public/logo.png 원본 이미지 사용
 *
 * variant:
 *   "login"  — 로그인 페이지 (넓게)
 *   "header" — 헤더 (좁게)
 */

import Image from "next/image";

interface BrandLogoProps {
  variant?: "login" | "header";
}

export default function BrandLogo({ variant = "header" }: BrandLogoProps) {
  if (variant === "login") {
    return (
      <Image
        src="/logo.png"
        alt="뉴퍼센트 스파르타 로고"
        width={280}
        height={90}
        priority
        className="object-contain"
      />
    );
  }

  // header: 세로 높이를 헤더에 맞게 제한
  return (
    <Image
      src="/logo.png"
      alt="뉴퍼센트 스파르타 로고"
      width={160}
      height={52}
      priority
      className="object-contain"
    />
  );
}
