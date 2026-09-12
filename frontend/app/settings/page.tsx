"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { updateSchool } from "@/lib/api/schools";
import { ApiError } from "@/lib/api/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Building2,
  Shield,
  CreditCard,
  Database,
  CheckCircle2,
  AlertCircle,
  Globe,
  Sliders,
} from "lucide-react";

export default function SettingsPage() {
  const { user, school, role, updateSchoolInSession } = useAuth();
  const [schoolName, setSchoolName] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!school) return;
    setSchoolName(school.name);
    setSchoolPhone(school.phone);
    setSchoolEmail(school.email);
    setSchoolAddress(school.address);
  }, [school]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setErrorMsg("");
    setIsSaving(true);

    try {
      const updated = await updateSchool(school.id, {
        name: schoolName,
        phone: schoolPhone,
        email: schoolEmail,
        address: schoolAddress,
      });
      updateSchoolInSession(updated);
      setSuccessMsg("School profile and operational settings saved successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            School Configuration &amp; Settings
          </h1>
          <p className="text-sm text-slate-500">
            Manage institutional profile, Paystack API keys, WhatsApp Gateway, and grading scales.
          </p>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-bold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-xs font-bold text-rose-800 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Institutional Profile */}
          <Card className="p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base font-bold text-slate-900">
                  School Institutional Identity
                </CardTitle>
              </div>
              <Badge variant="default">Lagos State Ministry of Education Approved</Badge>
            </CardHeader>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="officialSchoolName"
                label="Official School Name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
              />
              <Input
                id="registeredTelephone"
                label="Registered Telephone"
                value={schoolPhone}
                onChange={(e) => setSchoolPhone(e.target.value)}
                required
              />
              <Input
                id="officialEmail"
                label="Official Email"
                type="email"
                value={schoolEmail}
                onChange={(e) => setSchoolEmail(e.target.value)}
                required
              />
              <Input
                id="physicalAddress"
                label="Physical Address"
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                required
              />
            </div>
          </Card>

          {/* Integration Keys */}
          <Card className="p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold text-slate-900">
                  Payment &amp; External Integrations
                </CardTitle>
              </div>
              <Badge variant="success">Sandbox / Live Ready</Badge>
            </CardHeader>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-1">
                  Paystack Public Key
                </label>
                <input
                  type="text"
                  readOnly
                  value="pk_test_mock_paystack_schoolos_public_key"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-1">
                  Paystack Webhook URL (Production Endpoint)
                </label>
                <input
                  type="text"
                  readOnly
                  value="https://schoolos.app/api/payments/webhook"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-1">
                  WhatsApp Cloud Business API Account
                </label>
                <input
                  type="text"
                  readOnly
                  value="waba_act_emerald_crest_primary"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
                />
              </div>
            </div>
          </Card>

          {/* Grading Standards */}
          <Card className="p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-base font-bold text-slate-900">
                  Grading Standard &amp; Currency
                </CardTitle>
              </div>
              <Badge variant="secondary">National WAEC Scale</Badge>
            </CardHeader>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-1">
                  Operational Currency
                </label>
                <input
                  type="text"
                  readOnly
                  value="Nigerian Naira (NGN - ₦)"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-1">
                  Grade Scale
                </label>
                <input
                  type="text"
                  readOnly
                  value="5-Tier Standard WAEC (A: 75-100, B: 65-74, C: 50-64, D: 40-49, F: 0-39)"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                />
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" isLoading={isSaving} className="bg-blue-600 hover:bg-blue-700 text-sm px-6">
              Save All Settings
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
