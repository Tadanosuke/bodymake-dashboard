import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BodyMake Dashboard | 15kg減量プロジェクト",
  description: "スマホ対応ボディメイク＆減量管理ダッシュボード",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f1e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-[#0a0f1e] text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
