"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PeopleField, PeopleKind } from "@/types/people-fields";

const coreKeys = new Set(["firstName", "lastName", "gender", "classId", "armId", "admissionNumber", "middleName", "dateOfBirth", "address", "bloodGroup", "genotype", "guardianFirstName", "guardianLastName", "guardianPhone", "guardianEmail", "guardianRelationship", "email", "phone", "employeeId", "title", "joinDate", "department", "qualification", "yearsOfExperience"]);
export function PeopleFieldEditor({ kind, fields: configuredFields, onChange }: { kind: PeopleKind; fields?: PeopleField[] | null; onChange: (fields: PeopleField[]) => void }) {
  const fields = Array.isArray(configuredFields) ? configuredFields : [];
  const change = (index: number, patch: Partial<PeopleField>) => onChange(fields.map((f, i) => i === index ? { ...f, ...patch } : f));
  return <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
    <legend className="px-2 font-semibold capitalize">{kind} form and CSV fields</legend>
    <p className="text-sm text-slate-500">Choose the fields for your school. CSV headings match the field key, label, or any alias. Enter aliases separated by commas. Dates use YYYY-MM-DD. Required account and class fields must stay enabled.</p>
    {fields.map((field, index) => {
      const core = coreKeys.has(field.key);
      const essential = ["firstName", "lastName", ...(kind === "student" ? ["gender", "classId"] : ["email"])].includes(field.key);
      return <div key={index} className="space-y-3 rounded-lg border border-slate-200 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input id={`${kind}-key-${index}`} label="Field key" value={field.key} disabled={core} pattern="[a-z][a-zA-Z0-9]{0,49}" required onChange={(e) => change(index, { key: e.target.value })} />
          <Input id={`${kind}-label-${index}`} label="Field label / CSV heading" value={field.label} required maxLength={100} onChange={(e) => change(index, { label: e.target.value })} />
          <Select id={`${kind}-type-${index}`} label="Field type" value={field.type} disabled={core} onChange={(e) => change(index, { type: e.target.value as PeopleField["type"] })}>
            {["text", "email", "date", "number", "select"].map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
        </div>
        <Input key={`aliases-${field.key}`} id={`${kind}-aliases-${index}`} label="CSV aliases (comma separated)" defaultValue={field.aliases.join(", ")} onChange={(e) => change(index, { aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        {!core && field.type === "select" && <Input key={`options-${field.key}`} label="Choices (comma separated)" defaultValue={field.options.join(", ")} onChange={(e) => change(index, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label><input type="checkbox" checked={field.enabled} disabled={essential} onChange={(e) => change(index, { enabled: e.target.checked, required: e.target.checked && field.required })} /> Show field</label>
          <label><input type="checkbox" checked={field.required} disabled={essential || !field.enabled} onChange={(e) => change(index, { required: e.target.checked })} /> Required</label>
          {!core && <Button type="button" size="sm" variant="ghost" onClick={() => onChange(fields.filter((_, i) => i !== index))}>Remove field</Button>}
        </div>
      </div>;
    })}
    <Button type="button" variant="outline" onClick={() => {
      let n = 1; while (fields.some((f) => f.key === `customField${n}`)) n++;
      onChange([...fields, { key: `customField${n}`, label: `Custom field ${n}`, type: "text", enabled: true, required: false, aliases: [], options: [] }]);
    }}>Add {kind} field</Button>
  </fieldset>;
}
