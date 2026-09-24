"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT (Abuja)", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

interface FormState {
  schoolName: string;
  schoolEmail: string;
  schoolPhone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  currency: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
  confirmPassword: string;
}

const INITIAL_STATE: FormState = {
  schoolName: "",
  schoolEmail: "",
  schoolPhone: "",
  address: "",
  city: "",
  state: "Lagos",
  country: "Nigeria",
  currency: "NGN",
  ownerFullName: "",
  ownerEmail: "",
  ownerPhone: "",
  password: "",
  confirmPassword: "",
};

export default function RegisterSchoolPage() {
  const router = useRouter();
  const { registerSchool } = useAuth();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerSchool({
        school: {
          name: form.schoolName,
          address: form.address,
          city: form.city,
          state: form.state,
          country: form.country,
          phone: form.schoolPhone,
          email: form.schoolEmail,
          currency: form.currency,
        },
        owner: {
          fullName: form.ownerFullName,
          email: form.ownerEmail,
          phone: form.ownerPhone || undefined,
          password: form.password,
        },
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to register your school. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/60 px-4 py-12 relative selection:bg-brand-soft selection:text-brand">
      <div className="pointer-events-none fixed top-0 right-1/4 -z-10 h-96 w-96 rounded-full bg-brand-soft/40 blur-3xl" />
      <div className="w-full max-w-2xl">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 text-slate-900 group cursor-pointer">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-white shadow-sm group-hover:scale-105 transition-transform">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-heading text-xl font-black text-slate-900">SchoolOS</span>
        </Link>

        <Card className="shadow-card border-slate-200/80 rounded-3xl p-2 sm:p-4">
          <CardHeader className="text-center sm:text-left">
            <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Register your school</h1>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Set up your school&apos;s workspace and create the owner account that manages it.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              <fieldset className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                <legend className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
                  1. School details
                </legend>
                <Input
                  id="schoolName"
                  label="School name"
                  required
                  placeholder="e.g. Corona Secondary School"
                  value={form.schoolName}
                  onChange={update("schoolName")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="schoolEmail"
                    label="School email"
                    type="email"
                    required
                    placeholder="info@school.edu.ng"
                    value={form.schoolEmail}
                    onChange={update("schoolEmail")}
                  />
                  <Input
                    id="schoolPhone"
                    label="School phone"
                    type="tel"
                    required
                    placeholder="08012345678"
                    value={form.schoolPhone}
                    onChange={update("schoolPhone")}
                  />
                </div>
                <Input id="address" label="Address" required placeholder="e.g. 15 Admiralty Way" value={form.address} onChange={update("address")} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input id="city" label="City" required placeholder="e.g. Lekki" value={form.city} onChange={update("city")} />
                  <div className="w-full space-y-1.5">
                    <label htmlFor="state" className="text-xs font-semibold text-slate-700">
                      State
                    </label>
                    <select
                      id="state"
                      required
                      value={form.state}
                      onChange={update("state")}
                      className="flex h-10.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-all shadow-subtle hover:border-slate-300 focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
                    >
                      {NIGERIAN_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input id="country" label="Country" required value={form.country} onChange={update("country")} />
                </div>
              </fieldset>

              <fieldset className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                <legend className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
                  2. Owner account
                </legend>
                <Input
                  id="ownerFullName"
                  label="Full name"
                  required
                  placeholder="e.g. Dr. Ngozi Okonjo"
                  value={form.ownerFullName}
                  onChange={update("ownerFullName")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="ownerEmail"
                    label="Owner email"
                    type="email"
                    required
                    placeholder="proprietor@school.edu.ng"
                    value={form.ownerEmail}
                    onChange={update("ownerEmail")}
                  />
                  <Input
                    id="ownerPhone"
                    label="Owner phone (optional)"
                    type="tel"
                    placeholder="08098765432"
                    value={form.ownerPhone}
                    onChange={update("ownerPhone")}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="password"
                    label="Password"
                    type="password"
                    required
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={update("password")}
                  />
                  <Input
                    id="confirmPassword"
                    label="Confirm password"
                    type="password"
                    required
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={update("confirmPassword")}
                  />
                </div>
              </fieldset>

              {error && (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 border border-rose-200/80">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full rounded-2xl shadow-sm hover:shadow-md font-semibold" isLoading={isSubmitting}>
                Create school account <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-brand hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
