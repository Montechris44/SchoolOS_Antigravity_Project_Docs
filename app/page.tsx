"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <AppShell>
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          Loading SchoolOS workspace...
        </div>
      </div>
    </AppShell>
  );
}
