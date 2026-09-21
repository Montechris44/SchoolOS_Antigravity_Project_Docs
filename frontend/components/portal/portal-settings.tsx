"use client";

import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, Panel, useLoader } from "@/components/ui/portal";
import { ApiError } from "@/lib/api/client";
import { getPortalSettings, updatePortalSettings, uploadSchoolLogo } from "@/lib/api/portal-academics";
import { useAuth } from "@/lib/auth/auth-context";

/** School-portal switches: branding, sign-in domain for students, staff time rules and portal access. */
export function PortalSettings() {
  const { school, updateSchoolInSession, can } = useAuth();
  const settings = useLoader(getPortalSettings, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    themeColor: "#2563eb",
    studentEmailDomain: "",
    schoolCode: "",
    staffSignInCutoff: "08:00",
    staffVeryLateCutoff: "09:00",
    allowStudentPortal: true,
    allowParentPortal: true,
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setForm({
      themeColor: s.themeColor ?? "#2563eb",
      studentEmailDomain: s.studentEmailDomain ?? "",
      schoolCode: s.schoolCode ?? "",
      staffSignInCutoff: s.staffSignInCutoff.slice(0, 5),
      staffVeryLateCutoff: s.staffVeryLateCutoff.slice(0, 5),
      allowStudentPortal: s.allowStudentPortal,
      allowParentPortal: s.allowParentPortal,
    });
  }, [settings.data]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const updated = await updatePortalSettings({
        themeColor: form.themeColor,
        studentEmailDomain: form.studentEmailDomain.trim() || null,
        schoolCode: form.schoolCode.trim() || null,
        staffSignInCutoff: form.staffSignInCutoff,
        staffVeryLateCutoff: form.staffVeryLateCutoff,
        allowStudentPortal: form.allowStudentPortal,
        allowParentPortal: form.allowParentPortal,
      });
      if (school) updateSchoolInSession({ ...school, themeColor: updated.themeColor });
      setNotice({ tone: "success", text: "Portal settings saved." });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not save the settings." });
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async (file: File) => {
    try {
      const { logoUrl } = await uploadSchoolLogo(file);
      if (school) updateSchoolInSession({ ...school, logoUrl });
      setNotice({ tone: "success", text: "Logo updated." });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not upload the logo." });
    }
  };

  if (settings.loading) return <LoadingSkeleton count={2} />;
  if (settings.error) return <ErrorState message={settings.error} onRetry={settings.reload} />;

  return (
    <Panel title="School portal">
      <form onSubmit={save} className="space-y-6">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">Brand colour</p>
            <div className="flex items-center gap-3">
              <input type="color" value={form.themeColor} onChange={(e) => setForm({ ...form, themeColor: e.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300" />
              <span className="font-mono text-sm text-slate-600">{form.themeColor}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Used for buttons and highlights across your portal.</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">School logo</p>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <div className="flex items-center gap-3">
              {school?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={school.logoUrl} alt="" className="h-12 w-12 rounded-xl border border-slate-200 object-contain" />
              )}
              {can("school:manage") ? (
                <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}><ImagePlus className="mr-1.5 h-4 w-4" /> Upload logo</Button>
              ) : (
                <span className="text-xs text-slate-400">Only the proprietor can change the logo.</span>
              )}
            </div>
          </div>
          <Input label="Student sign-in domain" placeholder="myschool.edu.ng" value={form.studentEmailDomain} onChange={(e) => setForm({ ...form, studentEmailDomain: e.target.value })} />
          <Input label="School code (admission numbers)" placeholder="GREENFIELD" maxLength={12} value={form.schoolCode} onChange={(e) => setForm({ ...form, schoolCode: e.target.value })} />
          <Input label="Staff on-time until" type="time" value={form.staffSignInCutoff} onChange={(e) => setForm({ ...form, staffSignInCutoff: e.target.value })} />
          <Input label="Staff very late after" type="time" value={form.staffVeryLateCutoff} onChange={(e) => setForm({ ...form, staffVeryLateCutoff: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm">
            <input type="checkbox" checked={form.allowStudentPortal} onChange={(e) => setForm({ ...form, allowStudentPortal: e.target.checked })} />
            <span><strong className="block text-slate-800">Student portal</strong><span className="text-xs text-slate-500">Students can sign in.</span></span>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm">
            <input type="checkbox" checked={form.allowParentPortal} onChange={(e) => setForm({ ...form, allowParentPortal: e.target.checked })} />
            <span><strong className="block text-slate-800">Parent portal</strong><span className="text-xs text-slate-500">Parents can sign in.</span></span>
          </label>
        </div>

        <div className="flex justify-end"><Button type="submit" isLoading={busy}><Save className="mr-2 h-4 w-4" /> Save portal settings</Button></div>
      </form>
    </Panel>
  );
}

