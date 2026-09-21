import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";

const inter = Inter({ subsets: ["latin"] });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "SchoolOS — AI-Powered Operating System for Nigerian Schools",
  description:
    "Turn school activity into confident decisions. Unified management, academics, attendance, finance, Paystack billing, and AI Action Center.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${outfit.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
