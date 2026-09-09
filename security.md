# Security and Privacy

## Multi-tenancy
Use Supabase Row Level Security and server-side authorization. A user must only access resources belonging to authorized schools.

## Roles
Owner, Admin, Bursar, Teacher, Parent, Student.

## Security requirements
- Strict TypeScript.
- Input validation.
- Secure cookies/session handling.
- Server-only secrets.
- RLS policies tested for positive and negative cases.
- Audit logs for sensitive operations.
- Least privilege.
- Rate limiting for authentication, AI and messaging endpoints.
- Secure file uploads.
- No sensitive data in client logs.
- Dependency and secret scanning.

## Child/student data
Collect only what is required. Define retention, deletion/export and consent processes. Production launch requires appropriate Nigerian privacy/legal review and contractual data-processing terms.

## AI privacy
Do not send unnecessary student/parent PII to the model. Use minimum necessary context. Enforce tenant and role boundaries before tool calls.
