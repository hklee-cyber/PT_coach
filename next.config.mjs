/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // public/ 폴더 내 로컬 이미지는 별도 설정 불필요
    // 외부 이미지 도메인이 필요할 경우 remotePatterns에 추가
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
