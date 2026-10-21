// Run with NODE_ENV=test and the API/UI on ports 4011/3011:
// node --require ts-node/register/transpile-only tests/people-ui.e2e.cjs
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");
const { chromium } = require(path.join(os.tmpdir(), "schoolos-people-qa/node_modules/playwright"));
const { buildTestApp, registerTestSchool, uniqueSuffix, cleanupTestSchool, closeTestPool } = require("./helpers.ts");
const { pool } = require("../src/db/pool.ts");

(async () => {
  const app = buildTestApp();
  const suffix = uniqueSuffix();
  const schools = [];
  const emails = [];
  let browser;
  let page;
  const call = async (school, method, url, payload) => {
    const res = await app.inject({ method, url: `/api/v1${url}`, headers: { authorization: `Bearer ${school.token}` }, payload });
    assert.ok(res.statusCode < 300, `${method} ${url}: ${res.body}`);
    return res.json().data;
  };
  const trackCredentials = (data) => {
    if (data.credentials) emails.push(data.credentials.email);
    if (data.email) emails.push(data.email);
    for (const row of data.success ?? []) if (row.credentials) emails.push(row.credentials.email);
  };
  try {
    const school = await registerTestSchool(app, `${suffix}ui`); schools.push(school);
    const other = await registerTestSchool(app, `${suffix}other`); schools.push(other);
    assert.equal(school.response.statusCode, 201); assert.equal(other.response.statusCode, 201);
    await call(school, "POST", "/classes", { name: "Year 2", gradeLevel: "Year 2" });
    browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
    await context.addInitScript((token) => localStorage.setItem("schoolos_token", token), school.token);
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", async (r) => {
      if (r.url().endsWith("/school-settings") && r.request().method() === "PATCH") {
        const body = await r.json();
        console.log("Settings save status:", r.status(), body.message ?? body.error ?? "OK", body.details ?? "");
      }
    });
    // Reproduce the hosted server's older response, then verify Retry recovers.
    await page.route("**/api/v1/school-settings", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      delete body.data.studentFields;
      delete body.data.teacherFields;
      await route.fulfill({ response, json: body });
    });
    await page.goto("http://localhost:3011/settings");
    await page.getByText(/Student and teacher field settings are unavailable/).waitFor();
    assert.equal(await page.getByRole("group", { name: "student form and CSV fields", exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    await page.unroute("**/api/v1/school-settings");
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    console.log("PASS: missing API field arrays show a recoverable error, produce no runtime crash, and recover on Retry");
    console.log("Browser opened settings; waiting for school field configuration");
    const students = page.getByRole("group", { name: "student form and CSV fields", exact: true });
    await students.waitFor();
    await students.getByLabel("Field label / CSV heading", { exact: true }).first().fill("Pupil given name");
    await students.getByLabel("CSV aliases (comma separated)").first().fill("Given");
    await students.getByRole("button", { name: "Add student field", exact: true }).click();
    await students.getByLabel("Field key", { exact: true }).last().fill("transportRoute");
    await students.getByLabel("Field label / CSV heading", { exact: true }).last().fill("Bus route");
    await students.getByLabel("Required", { exact: true }).last().check();
    const teachers = page.getByRole("group", { name: "teacher form and CSV fields", exact: true });
    await teachers.getByRole("button", { name: "Add teacher field", exact: true }).click();
    await teachers.getByLabel("Field key", { exact: true }).last().fill("teachingRank");
    await teachers.getByLabel("Field label / CSV heading", { exact: true }).last().fill("Teaching rank");
    await teachers.getByLabel("Field type", { exact: true }).last().selectOption("number");
    await teachers.getByLabel("Required", { exact: true }).last().check();
    await page.getByRole("button", { name: "Save portal settings", exact: true }).click();
    const invalid = await page.locator("form input:invalid").evaluateAll((inputs) => inputs.map((input) => ({ id: input.id, message: input.validationMessage })));
    if (invalid.length) console.error("Invalid settings controls:", invalid);
    await page.getByText("Portal settings saved.", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("group", { name: "student form and CSV fields", exact: true }).waitFor();
    assert.equal(await page.locator("#student-label-0").inputValue(), "Pupil given name");
    assert.equal(await page.getByRole("group", { name: "student form and CSV fields", exact: true }).getByLabel("Field key", { exact: true }).last().inputValue(), "transportRoute");
    console.log("PASS: settings editor persists renamed fields, aliases and custom required fields for students and teachers");

    await page.goto("http://localhost:3011/students");
    await page.getByRole("button", { name: "Enrol student", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "Enrol a student", exact: true });
    await dialog.getByLabel("Pupil given name", { exact: true }).fill(`Manual${suffix}`);
    await dialog.getByLabel("Last name", { exact: true }).fill("Student");
    await dialog.getByLabel("Gender", { exact: true }).selectOption("female");
    await dialog.getByLabel("Bus route", { exact: true }).fill("Lagoon");
    let saved = page.waitForResponse((r) => r.url().endsWith("/students") && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Enrol student", exact: true }).click();
    let response = await saved; assert.equal(response.status(), 201); trackCredentials((await response.json()).data);
    await page.getByRole("dialog", { name: "Sign-in details", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
    await page.getByText(`Manual${suffix} Student`, { exact: true }).click();
    await page.getByRole("dialog").getByText("Lagoon", { exact: true }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    console.log("PASS: student form uses the school label, saves required custom values, and displays them on the record");

    const downloadReady = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV template", exact: true }).click();
    const download = await downloadReady;
    const template = await fs.readFile(await download.path(), "utf8");
    assert.ok(template.includes('"Pupil given name"') && template.includes('"Bus route"'));
    const upload = page.locator('input[type="file"][accept=".csv,text/csv"]');
    const before = (await call(school, "GET", "/students")).length;
    await upload.setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from("Given,Surname,Sex,Class,Unmapped\nWrong,Row,F,Year 2,X") });
    dialog = page.getByRole("dialog", { name: "Preview student import", exact: true });
    await dialog.getByText(/Unmapped column/).waitFor();
    assert.equal(await dialog.getByRole("button", { name: "Save 1 student(s)", exact: true }).isDisabled(), true);
    assert.equal((await call(school, "GET", "/students")).length, before);
    await dialog.getByRole("button", { name: "Close", exact: true }).last().click();
    await upload.setInputFiles({ name: "students.csv", mimeType: "text/csv", buffer: Buffer.from(`Given,Surname,Sex,Class,Bus route\nCsv${suffix},Student,F,Year 2,"Route, A"`) });
    dialog = page.getByRole("dialog", { name: "Preview student import", exact: true });
    const importButton = dialog.getByRole("button", { name: "Save 1 student(s)", exact: true });
    await importButton.waitFor();
    await dialog.getByText("Route, A", { exact: true }).waitFor();
    assert.equal((await call(school, "GET", "/students")).length, before);
    saved = page.waitForResponse((r) => r.url().endsWith("/students/import") && r.request().method() === "POST");
    await importButton.click(); response = await saved; assert.equal(response.status(), 201); trackCredentials((await response.json()).data);
    await page.getByRole("dialog", { name: "Sign-in details", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
    await dialog.getByRole("button", { name: "Close", exact: true }).last().click();
    await page.getByText(`Csv${suffix} Student`, { exact: true }).waitFor();
    console.log("PASS: CSV templates, alias mapping, quoted values, validation preview, blocked invalid save and confirmed student import");

    await page.goto("http://localhost:3011/staff");
    await page.getByRole("button", { name: "Add staff", exact: true }).first().click();
    dialog = page.getByRole("dialog", { name: "Add staff member", exact: true });
    await dialog.getByLabel("First name", { exact: true }).fill(`Teacher${suffix}`);
    await dialog.getByLabel("Last name", { exact: true }).fill("Manual");
    await dialog.getByLabel("E-mail (used to sign in)", { exact: true }).fill(`teacher-ui+${suffix}@backend-tests.local`);
    await dialog.getByLabel("Teaching rank", { exact: true }).fill("0");
    saved = page.waitForResponse((r) => r.url().endsWith("/staff") && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Create account", exact: true }).click();
    response = await saved; assert.equal(response.status(), 201); trackCredentials((await response.json()).data);
    await page.getByRole("dialog", { name: "Sign-in details", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
    const card = page.locator("div").filter({ has: page.getByRole("heading", { name: `Teacher${suffix} Manual`, exact: true }) }).filter({ has: page.getByRole("button", { name: "Edit", exact: true }) });
    await card.last().getByRole("button", { name: "Edit", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Edit staff member", exact: true });
    assert.equal(await dialog.getByLabel("Teaching rank", { exact: true }).inputValue(), "0");
    await dialog.getByLabel("Teaching rank", { exact: true }).fill("2");
    await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
    await page.getByText("Staff details updated.", { exact: true }).waitFor();
    const teacher = (await call(school, "GET", "/staff")).find((s) => s.firstName === `Teacher${suffix}`);
    assert.equal(teacher.customFields.teachingRank, 2);
    const teacherCsv = `First name,Surname,Email,Teaching rank\nCsvTeacher${suffix},Staff,csv-teacher-ui+${suffix}@backend-tests.local,1`;
    await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles({ name: "teachers.csv", mimeType: "text/csv", buffer: Buffer.from(teacherCsv) });
    dialog = page.getByRole("dialog", { name: "Preview teacher import", exact: true });
    await dialog.getByRole("button", { name: "Save 1 teacher(s)", exact: true }).waitFor();
    saved = page.waitForResponse((r) => r.url().endsWith("/staff/import") && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Save 1 teacher(s)", exact: true }).click();
    response = await saved; assert.equal(response.status(), 201); trackCredentials((await response.json()).data);
    await page.getByRole("dialog", { name: "Sign-in details", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
    await dialog.getByRole("button", { name: "Close", exact: true }).last().click();
    await page.getByText(`CsvTeacher${suffix} Staff`, { exact: true }).waitFor();
    console.log("PASS: teacher creation, numeric zero, edit persistence and CSV import with custom fields");

    await page.goto("http://localhost:3011/people");
    await page.getByRole("button", { name: "Enroll Student", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Enroll New Scholar", exact: true });
    await dialog.getByLabel("Pupil given name", { exact: true }).waitFor();
    await dialog.getByLabel("Bus route", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const otherContext = await browser.newContext();
    await otherContext.addInitScript((token) => localStorage.setItem("schoolos_token", token), other.token);
    const otherPage = await otherContext.newPage();
    await otherPage.goto("http://localhost:3011/students");
    await otherPage.getByRole("button", { name: "Enrol student", exact: true }).click();
    await otherPage.getByRole("dialog").getByLabel("First name", { exact: true }).waitFor();
    assert.equal(await otherPage.getByLabel("Bus route", { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: legacy enrollment also uses school fields; another school retains its independent form; no browser runtime errors");
  } catch (err) {
    if (page) console.error("Browser failure context:", { url: page.url(), headings: await page.getByRole("heading").allTextContents(), legends: await page.locator("legend").allTextContents(), alerts: await page.locator('[role="alert"]').allTextContents() });
    throw err;
  } finally {
    if (browser) await browser.close();
    for (const school of schools) await cleanupTestSchool(school.schoolId, school.ownerEmail, school.schoolEmail);
    await pool.query("DELETE FROM profiles WHERE email = ANY($1)", [emails]);
    await app.close(); await closeTestPool();
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
