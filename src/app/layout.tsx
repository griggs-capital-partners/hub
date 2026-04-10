import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Smart Hub — Griggs Capital Partners",
  description: "The central command hub for the Griggs Capital Partners dev team",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full dark`} suppressHydrationWarning>
      <body className="h-full bg-[#0D0D0D] text-[#F0F0F0] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
