import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "GhostVest | 隐私薪酬 Claim",
  description: "GhostVest - 去中心化隐私薪酬基础设施",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${jetbrainsMono.variable} font-mono`}>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
