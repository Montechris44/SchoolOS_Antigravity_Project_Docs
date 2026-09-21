import { withTransaction, query } from "../../db/pool";
import { NotFoundError } from "../../shared/http/errors";
import { FinanceActor, financeVisibility } from "../../shared/security/finance-scope";
import { getCurrentTermId } from "../terms/terms.service";
import { CreateInvoiceInput } from "./invoices.schemas";

const INVOICE_SELECT = `
  SELECT
    i.id, i.school_id, i.invoice_number, i.student_id,
    s.first_name AS student_first_name, s.last_name AS student_last_name, s.admission_number,
    i.guardian_id,
    g.first_name AS guardian_first_name, g.last_name AS guardian_last_name,
    g.email AS guardian_email, g.phone AS guardian_phone,
    i.term_id, t.name AS term_name,
    i.total_amount, i.amount_paid, i.balance_due, i.status, i.due_date, i.issued_at,
    COALESCE(
      json_agg(json_build_object('id', ii.id, 'description', ii.description, 'amount', ii.amount))
        FILTER (WHERE ii.id IS NOT NULL),
      '[]'
    ) AS items
  FROM invoices i
  JOIN students s ON s.id = i.student_id
  LEFT JOIN guardians g ON g.id = i.guardian_id
  JOIN terms t ON t.id = i.term_id
  LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
`;

const INVOICE_GROUP_BY =
  "GROUP BY i.id, s.first_name, s.last_name, s.admission_number, g.first_name, g.last_name, g.email, g.phone, t.name";

interface InvoiceRow {
  id: string;
  school_id: string;
  invoice_number: string;
  student_id: string;
  student_first_name: string;
  student_last_name: string;
  admission_number: string;
  guardian_id: string | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  term_id: string;
  term_name: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  due_date: string;
  issued_at: string;
  items: Array<{ id: string; description: string; amount: number }>;
}

function toInvoiceRecord(row: InvoiceRow) {
  return {
    id: row.id,
    school_id: row.school_id,
    invoice_number: row.invoice_number,
    student_id: row.student_id,
    student_name: `${row.student_first_name} ${row.student_last_name}`,
    admission_number: row.admission_number,
    guardian_id: row.guardian_id,
    guardian_name: row.guardian_id ? `${row.guardian_first_name} ${row.guardian_last_name}` : null,
    guardian_email: row.guardian_email,
    guardian_phone: row.guardian_phone,
    term_id: row.term_id,
    term_name: row.term_name,
    total_amount: row.total_amount,
    amount_paid: row.amount_paid,
    balance_due: row.balance_due,
    status: row.status,
    due_date: row.due_date,
    issued_at: row.issued_at,
    items: row.items,
  };
}

export async function listInvoices(schoolId: string, studentId?: string, actor?: FinanceActor) {
  const conditions = ["i.school_id = $1"];
  const params: unknown[] = [schoolId];

  if (studentId) {
    params.push(studentId);
    conditions.push(`i.student_id = $${params.length}`);
  }
  if (actor) {
    conditions.push(financeVisibility(actor, params, "i.student_id"));
  }

  const result = await query<InvoiceRow>(
    `${INVOICE_SELECT} WHERE ${conditions.join(" AND ")} ${INVOICE_GROUP_BY} ORDER BY i.issued_at DESC`,
    params
  );

  return result.rows.map(toInvoiceRecord);
}

export async function getInvoiceById(schoolId: string, invoiceId: string) {
  const result = await query<InvoiceRow>(
    `${INVOICE_SELECT} WHERE i.school_id = $1 AND i.id = $2 ${INVOICE_GROUP_BY}`,
    [schoolId, invoiceId]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError("Invoice not found.");
  }

  return toInvoiceRecord(result.rows[0]);
}

async function generateInvoiceNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const countResult = await query<{ count: string }>(
    "SELECT COUNT(*) FROM invoices WHERE school_id = $1 AND invoice_number LIKE $2",
    [schoolId, `INV-${year}-%`]
  );
  const nextSeq = parseInt(countResult.rows[0].count, 10) + 1;
  return `INV-${year}-${String(nextSeq).padStart(3, "0")}`;
}

export async function createInvoice(schoolId: string, input: CreateInvoiceInput) {
  const studentResult = await query<{ id: string; guardian_id: string | null }>(
    "SELECT id, guardian_id FROM students WHERE school_id = $1 AND id = $2",
    [schoolId, input.studentId]
  );

  if (studentResult.rowCount === 0) {
    throw new NotFoundError("Student not found.");
  }

  const student = studentResult.rows[0];
  const termId = input.termId ?? (await getCurrentTermId(schoolId));
  const invoiceNumber = await generateInvoiceNumber(schoolId);

  const invoiceId = await withTransaction(async (client) => {
    const invoiceResult = await client.query<{ id: string }>(
      `INSERT INTO invoices (school_id, invoice_number, student_id, guardian_id, term_id, total_amount, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [schoolId, invoiceNumber, input.studentId, student.guardian_id, termId, input.amount, input.dueDate]
    );
    const newInvoiceId = invoiceResult.rows[0].id;

    await client.query(
      `INSERT INTO invoice_items (invoice_id, description, amount) VALUES ($1, $2, $3)`,
      [newInvoiceId, input.description, input.amount]
    );

    return newInvoiceId;
  });

  return getInvoiceById(schoolId, invoiceId);
}
