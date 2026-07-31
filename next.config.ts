import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // スマホなど同一LANから http://192.168.x.x:3000 で開くときに必要
  allowedDevOrigins: ["192.168.2.100", "127.0.0.1"],
  // 対局画面の左下（自分情報）と重ならないよう、開発インジケータ「N」を右上へ
  devIndicators: {
    position: "top-right",
  },
};

export default nextConfig;
