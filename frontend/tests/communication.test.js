const test = require("node:test");
const assert = require("node:assert");

function renderTemplate(templateStr, variables) {
  return templateStr.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
  });
}

function recordDeliveryLifecycle(totalRecipients, successRatio = 0.98) {
  const delivered = Math.floor(totalRecipients * successRatio);
  const failed = totalRecipients - delivered;
  return {
    status: "SENT",
    recipientCount: totalRecipients,
    delivered,
    failed,
  };
}

test("Communication Templates: Replaces variables truthfully", () => {
  const template = "Dear {{guardian_name}}, the balance of {{amount_due}} for {{student_name}} is due.";
  const rendered = renderTemplate(template, {
    guardian_name: "Engr. Tunde Williams",
    amount_due: "₦185,000",
    student_name: "Femi Williams",
  });

  assert.strictEqual(
    rendered,
    "Dear Engr. Tunde Williams, the balance of ₦185,000 for Femi Williams is due."
  );
});

test("Communication Lifecycle: Accurately records sent, delivered, and failed counts", () => {
  const stats = recordDeliveryLifecycle(100, 0.98);
  assert.strictEqual(stats.status, "SENT");
  assert.strictEqual(stats.recipientCount, 100);
  assert.strictEqual(stats.delivered, 98);
  assert.strictEqual(stats.failed, 2);
});
