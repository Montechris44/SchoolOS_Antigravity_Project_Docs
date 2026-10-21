"use client";
import React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PeopleField, PeopleKind } from "@/types/people-fields";
import { PortalClass } from "@/types/portal";

const coreKeys = new Set(["firstName", "lastName", "gender", "classId", "armId", "admissionNumber", "middleName", "dateOfBirth", "address", "bloodGroup", "genotype", "email", "phone", "employeeId", "title", "joinDate", "department", "qualification", "yearsOfExperience"]);
export function peopleFormBody(kind: PeopleKind, fields: PeopleField[], values: Record<string, string>): Record<string, any> {
  const data: Record<string, any> = kind === "teacher" ? { role: "teacher" } : {};
  const custom: Record<string, string | number> = {};
  const guardian: Record<string, string> = {};
  for (const field of fields.filter((f) => f.enabled)) {
    const raw = values[field.key]?.trim();
    if (!raw) continue;
    const value = field.type === "number" ? Number(raw) : raw;
    if (field.key.startsWith("guardian") && ["guardianFirstName", "guardianLastName", "guardianPhone", "guardianEmail", "guardianRelationship"].includes(field.key)) guardian[field.key.slice(8, 9).toLowerCase() + field.key.slice(9)] = raw;
    else if (coreKeys.has(field.key)) data[field.key] = value;
    else custom[field.key] = value;
  }
  if (Object.keys(guardian).length) data.guardian = { relationship: "guardian", ...guardian };
  data.customFields = custom;
  return data;
}

export function PeopleFormFields({ fields, values, onChange, classes = [] }: { fields: PeopleField[]; values: Record<string, string>; onChange: (values: Record<string, string>) => void; classes?: PortalClass[] }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.filter((f) => f.enabled).map((field) => {
    const options = field.key === "classId" ? classes.map((c) => ({ value: c.id, label: c.name }))
      : field.key === "armId" ? (classes.find((c) => c.id === values.classId)?.arms ?? []).map((a) => ({ value: a.id, label: a.name }))
      : field.options.map((value) => ({ value, label: value }));
    const change = (value: string) => onChange({ ...values, [field.key]: value, ...(field.key === "classId" ? { armId: "" } : {}) });
    return field.type === "select" ? <Select key={field.key} id={`person-${field.key}`} label={field.label} required={field.required} value={values[field.key] ?? ""} onChange={(e) => change(e.target.value)}>
      <option value="">Select {field.label.toLowerCase()}</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select> : <Input key={field.key} id={`person-${field.key}`} label={field.label} type={field.type} step={field.type === "number" ? "any" : undefined} maxLength={2000} required={field.required} value={values[field.key] ?? ""} onChange={(e) => change(e.target.value)} />;
  })}</div>;
}
