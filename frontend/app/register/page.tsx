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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-2xl">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">SchoolOS</span>
        </Link>

        <Card>
          <CardHeader>
            <h1 className="text-xl font-bold text-slate-900">Register your school</h1>
            <p className="text-sm text-slate-500">
              Set up your school&apos;s workspace and create the owner account that manages it.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              <fieldset className="space-y-4">
                <legend className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  School details
                </legend>
                <Input
                  id="schoolName"
                  label="School name"
                  required
                  value={form.schoolName}
                  onChange={update("schoolName")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="schoolEmail"
                    label="School email"
                    type="email"
                    required
                    value={form.schoolEmail}
                    onChange={update("schoolEmail")}
                  />
                  <Input
                    id="schoolPhone"
                    label="School phone"
                    type="tel"
                    required
                    value={form.schoolPhone}
                    onChange={update("schoolPhone")}
                  />
                </div>
                <Input id="address" label="Address" required value={form.address} onChange={update("address")} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input id="city" label="City" required value={form.city} onChange={update("city")} />
                  <div className="w-full space-y-1.5">
                    <label htmlFor="state" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      State
                    </label>
                    <select
                      id="state"
                      required
                      value={form.state}
                      onChange={update("state")}
                      className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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

              <fieldset className="space-y-4">
                <legend className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Owner account
                </legend>
                <Input
                  id="ownerFullName"
                  label="Full name"
                  required
                  value={form.ownerFullName}
                  onChange={update("ownerFullName")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="ownerEmail"
                    label="Owner email"
                    type="email"
                    required
                    value={form.ownerEmail}
                    onChange={update("ownerEmail")}
                  />
                  <Input
                    id="ownerPhone"
                    label="Owner phone (optional)"
                    type="tel"
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
                    autoComplete="new-password"
                    value={form.password}
                    onChange={update("password")}
                  />
                  <Input
                    id="confirmPassword"
                    label="Confirm password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={update("confirmPassword")}
                  />
                </div>
              </fieldset>

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 border border-rose-200">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Create school account <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
