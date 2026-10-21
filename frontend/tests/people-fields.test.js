const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
// Load the actual TSX components with the same @/ alias used by Next.js.
const root = path.resolve(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(this, name.startsWith("@/") ? path.join(root, name.slice(2)) : name, ...args);
};
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (mod, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  mod._compile(code, filename);
};
const { PeopleFormFields, peopleFormBody } = require("../components/portal/people-form-fields.tsx");
const { PeopleFieldEditor } = require("../components/portal/people-field-editor.tsx");
const { getPortalSettings, updatePortalSettings } = require("../lib/api/portal-academics.ts");
const field = (key, type = "text", patch = {}) => ({ key, label: key, type, required: false, enabled: true, aliases: [], options: [], ...patch });

test("school form renders configured labels, required inputs, choices, numeric zero and class-specific arms", () => {
  const fields = [field("firstName", "text", { label: "Pupil name", required: true }), field("hidden", "text", { enabled: false }), field("points", "number"), field("house", "select", { options: ["Red", "Blue"] }), field("classId", "select"), field("armId", "select")];
  const html = renderToStaticMarkup(React.createElement(PeopleFormFields, { fields, values: { firstName: "Ada", points: "0", classId: "class1" }, onChange() {}, classes: [{ id: "class1", name: "Year 1", arms: [{ id: "arm1", name: "Gold" }] }, { id: "class2", name: "Year 2", arms: [{ id: "arm2", name: "Silver" }] }] }));
  assert.match(html, /Pupil name/); assert.match(html, /required=""/); assert.match(html, /value="0"/);
  assert.match(html, />Red</); assert.match(html, />Gold</); assert.doesNotMatch(html, />Silver</); assert.doesNotMatch(html, /person-hidden/);
});
test("manual student payload preserves custom fields and complete guardian data without hidden values", () => {
  const fields = [field("firstName"), field("lastName"), field("classId", "select"), field("points", "number"), field("route"), field("secret", "text", { enabled: false }), ...["FirstName", "LastName", "Phone", "Email"].map((key) => field(`guardian${key}`))];
  const result = peopleFormBody("student", fields, { firstName: " Ada ", lastName: "Okafor", classId: "class1", points: "0", route: "Bus A", secret: "hidden", guardianFirstName: "Parent", guardianLastName: "Okafor", guardianPhone: "08000000000", guardianEmail: "parent@example.com" });
  assert.deepEqual(result, { firstName: "Ada", lastName: "Okafor", classId: "class1", customFields: { points: 0, route: "Bus A" }, guardian: { firstName: "Parent", lastName: "Okafor", phone: "08000000000", email: "parent@example.com", relationship: "guardian" } });
});
test("manual teacher payload fixes the role and handles dates, numbers and empty optional inputs", () => {
  const fields = [field("firstName"), field("email", "email"), field("yearsOfExperience", "number"), field("license"), field("renewal", "date"), field("phone")];
  assert.deepEqual(peopleFormBody("teacher", fields, { firstName: "Grace", email: "g@example.com", yearsOfExperience: "12", license: "TRCN-42", renewal: "2027-01-01", phone: "" }), { role: "teacher", firstName: "Grace", email: "g@example.com", yearsOfExperience: 12, customFields: { license: "TRCN-42", renewal: "2027-01-01" } });
});
test("settings editor exposes independent student/teacher fields, CSV aliases and custom types", () => {
  for (const kind of ["student", "teacher"]) {
    const html = renderToStaticMarkup(React.createElement(PeopleFieldEditor, { kind, fields: [field("firstName", "text", { required: true }), field("license")], onChange() {} }));
    assert.match(html, new RegExp(`${kind} form and CSV fields`)); assert.match(html, /CSV aliases/); assert.match(html, /Remove field/); assert.match(html, /Field type/);
  }
});

test("field editor renders safely when the field array is missing or null", () => {
  for (const fields of [undefined, null]) {
    const html = renderToStaticMarkup(React.createElement(PeopleFieldEditor, { kind: "student", fields, onChange() {} }));
    assert.match(html, /Add student field/);
    assert.doesNotMatch(html, /Field label \/ CSV heading/);
  }
});

test("settings API rejects legacy or incomplete responses before consumers receive undefined arrays", async (t) => {
  let data;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ data }), { status: 200, headers: { "content-type": "application/json" } }));
  for (const incomplete of [{ schoolId: "old-server" }, { studentFields: [] }, { teacherFields: [] }, { studentFields: null, teacherFields: [] }, { studentFields: [], teacherFields: {} }]) {
    data = incomplete;
    await assert.rejects(getPortalSettings(), (err) => err.status === 503 && /update the server/.test(err.message));
    await assert.rejects(updatePortalSettings({ studentFields: [] }), (err) => err.status === 503);
  }
});

test("settings API preserves supported field definitions and recovers after a server update", async (t) => {
  let data = { schoolId: "school1" };
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ data }), { status: 200, headers: { "content-type": "application/json" } }));
  await assert.rejects(getPortalSettings());
  data = { schoolId: "school1", studentFields: [field("firstName")], teacherFields: [field("email", "email")] };
  assert.deepEqual(await getPortalSettings(), data);
  assert.deepEqual(await updatePortalSettings({ studentFields: data.studentFields }), data);
});
