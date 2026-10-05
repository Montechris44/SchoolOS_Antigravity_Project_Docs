import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import { Preloader } from "@/components/ui/preloader";

const inter = Inter({ subsets: ["latin"] });
// A warm, bookish serif for headings gives the portal a classroom / textbook voice.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-heading", axes: ["opsz"] });

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
      <body className={`${inter.className} ${fraunces.variable}`}>
        <AuthProvider>
          <Preloader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
