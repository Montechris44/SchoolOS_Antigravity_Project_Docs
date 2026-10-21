# School-specific student and teacher fields

School owners and admins configure these under **Settings → School portal → Student/teacher form and CSV fields**. They can rename labels, add CSV heading aliases, hide optional fields, require fields, and add custom text, email, number, date, or select fields. Required identity, sign-in, and class fields retain their system types. Custom keys must be stable lower-camel-case identifiers, such as `transportRoute`.

Definitions are stored separately in `school_settings.student_fields` and `teacher_fields`, scoped to the authenticated school. Values are stored in the record's `custom_fields` JSONB column and returned as `customFields`. Defaults apply until a school saves its configuration. Existing records retain their values when a field is hidden or removed.

The student screens (including People overview) and teacher creation/editing under Staff use the school definitions. Other staff roles keep their existing forms.

## CSV workflow

Download **CSV template** from Students or Staff, or use an existing CSV whose headings match the configured keys, labels, or aliases. Heading matching ignores case, spaces, underscores, dots, hyphens, slashes, and parentheses. Student classes/arms may be names or IDs; they must belong to the authenticated school. Gender accepts `M`/`F` as well as the full values. Dates must use `YYYY-MM-DD`.

1. `POST /api/v1/students/import/preview` or `/api/v1/staff/import/preview` with `{ "csv": "..." }` returns mappings, per-record values, validation errors, and a `previewToken`. It creates no people/accounts.
2. Review all rows. Unknown/duplicate headings, missing required fields, invalid values, and duplicate identifiers within the file prevent confirmation. Fix the CSV or settings and preview again.
3. `POST /api/v1/students/import` or `/api/v1/staff/import` with `{ "csv": "...", "previewToken": "..." }` validates again and saves. Changing the file, settings, or resolved class/arm data invalidates the preview. Teacher imports always create the teacher role.

Files are limited to 300 records and 1 MB. Commit responses include `success`/`failed` arrays with original record indexes and one-time credentials for successful accounts. Database conflicts are reported per record; successful records remain saved. Retry only failed records after addressing conflicts. A network failure requires a fresh preview and checking the list before retrying.

Manual `POST /students`, legacy `POST /students/bulk-import`, and `POST /staff` (teacher role) also enforce school requirements. A canonical request sends additional values under `customFields`, for example `"customFields": { "transportRoute": "Lagoon", "teachingRank": 0 }`. Settings updates require an owner/admin; student imports require `students:manage`, teacher imports `staff:manage`.

## Verification

Apply migrations with `npm run migrate`. From backend, set `NODE_ENV=test` and run `npm test` and `npm run build`. From frontend, run `npm test`, `npm run lint`, and `npm run build`. New tests exercise the real field rendering/payload code, CSV parser, API validation, persistence, permissions, and two-school isolation.

`tests/people-ui.e2e.cjs` additionally tests the browser flow against isolated test schools. It expects the API on port 4011 (`NODE_ENV=test`, `CORS_ORIGIN=http://localhost:3011`) and the frontend on port 3011 (`NEXT_PUBLIC_API_URL=http://localhost:4011/api/v1`). Install temporary tooling with `npm install --prefix "$env:TEMP/schoolos-people-qa" --no-save --package-lock=false playwright`, then run `node --require ts-node/register/transpile-only tests/people-ui.e2e.cjs` from backend. It uses installed Chrome, cleans up its schools/accounts, and covers settings persistence, both forms/imports, invalid-file blocking, templates, custom numeric zero, editing, credentials, and independent forms for another school.
