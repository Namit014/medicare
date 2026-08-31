import type { Metadata } from "next";
import { DM_Sans, Doto, Bai_Jamjuree } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
});

const baiJamjuree = Bai_Jamjuree({
  weight: ['400', '600', '700'],
  variable: "--font-bai-jamjuree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Medicare",
  description: "Smart Pill Dispenser",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${doto.variable} ${baiJamjuree.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans bg-[#d9d9d9]">{children}</body>
    </html>
  );
}
