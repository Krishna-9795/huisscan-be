import { InvoiceStatus } from "@prisma/client";

export type InvoicePdfInput = {
  number: string;
  description: string;
  amountCents: number;
  subtotalAmountCents?: number;
  vatAmountCents?: number;
  totalAmountCents?: number;
  currency: string;
  vatType?: string;
  vatRateBps?: number;
  vatSlabName?: string | null;
  status: InvoiceStatus | string;
  provider?: string | null;
  providerId?: string | null;
  issuedAt: Date;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

export function generateInvoicePdf(input: InvoicePdfInput): Buffer {
  const content = createInvoicePageContent(input);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    [
      "<< /Type /Page /Parent 2 0 R",
      `/MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}]`,
      "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >>",
      "/Contents 6 0 R >>",
    ].join(" "),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
  ];

  return buildPdf(objects);
}

function createInvoicePageContent(input: InvoicePdfInput) {
  const paidLabel = input.status.toString().toUpperCase();
  const subtotalAmount = formatAmount(
    input.subtotalAmountCents ?? input.amountCents,
    input.currency,
  );
  const vatAmount = formatAmount(input.vatAmountCents ?? 0, input.currency);
  const totalAmount = formatAmount(
    input.totalAmountCents ?? input.amountCents,
    input.currency,
  );
  const vatLabel = formatVatLabel(input);
  const issuedAt = formatInvoiceDate(input.issuedAt);
  const lines = wrapText(input.description, 64);
  const providerLine = [input.provider, input.providerId].filter(Boolean).join(" - ");

  const parts = [
    rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, [0.98, 0.98, 0.99]),
    rect(0, PAGE_HEIGHT - 116, PAGE_WIDTH, 116, [0.2, 0.13, 0.38]),
    text("HuisValue", 48, 774, 24, "F2", [1, 1, 1]),
    text("Smart property reports for the Netherlands", 48, 754, 10, "F1", [
      0.86,
      0.84,
      0.92,
    ]),
    text("INVOICE", 426, 774, 22, "F2", [1, 1, 1]),
    text(`No. ${input.number}`, 426, 754, 10, "F1", [0.86, 0.84, 0.92]),
    text("BILLED TO", 48, 674, 9, "F2", [0.45, 0.45, 0.5]),
    text("HuisValue customer", 48, 654, 12, "F2", [0.12, 0.12, 0.15]),
    text("ISSUED", 352, 674, 9, "F2", [0.45, 0.45, 0.5]),
    text(issuedAt, 352, 654, 12, "F1", [0.12, 0.12, 0.15]),
    text("STATUS", 456, 674, 9, "F2", [0.45, 0.45, 0.5]),
    text(paidLabel, 456, 654, 12, "F2", statusColor(input.status)),
    line(48, 596, 547, 596, [0.86, 0.86, 0.88]),
    text("DESCRIPTION", 48, 616, 9, "F2", [0.45, 0.45, 0.5]),
    text("TOTAL", 452, 616, 9, "F2", [0.45, 0.45, 0.5]),
  ];

  lines.forEach((lineText, index) => {
    parts.push(text(lineText, 48, 568 - index * 16, 11, "F1", [0.12, 0.12, 0.15]));
  });

  parts.push(text(totalAmount, 434, 568, 11, "F2", [0.12, 0.12, 0.15]));
  parts.push(line(48, 526, 547, 526, [0.86, 0.86, 0.88]));
  parts.push(text("Subtotal", 352, 496, 10, "F1", [0.35, 0.35, 0.4]));
  parts.push(text(subtotalAmount, 434, 496, 10, "F1", [0.12, 0.12, 0.15]));
  parts.push(text(vatLabel, 352, 476, 10, "F1", [0.35, 0.35, 0.4]));
  parts.push(text(vatAmount, 434, 476, 10, "F1", [0.12, 0.12, 0.15]));
  parts.push(text("Total paid", 352, 448, 13, "F2", [0.12, 0.12, 0.15]));
  parts.push(text(totalAmount, 434, 448, 13, "F2", [0.12, 0.12, 0.15]));

  if (providerLine) {
    parts.push(text("PAYMENT REFERENCE", 48, 410, 9, "F2", [0.45, 0.45, 0.5]));
    parts.push(text(providerLine, 48, 392, 10, "F1", [0.18, 0.18, 0.22]));
  }

  parts.push(
    text(
      "Thank you for choosing HuisValue. This invoice confirms your report payment.",
      48,
      112,
      9,
      "F1",
      [0.45, 0.45, 0.5],
    ),
  );
  parts.push(text("huisvalue.nl", 48, 92, 9, "F2", [0.2, 0.13, 0.38]));

  return parts.join("");
}

function buildPdf(objects: string[]) {
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

function text(
  value: string,
  x: number,
  y: number,
  size: number,
  font: "F1" | "F2",
  color: [number, number, number],
) {
  return [
    `${color.join(" ")} rg`,
    "BT",
    `/${font} ${size} Tf`,
    `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`,
    `(${escapePdfText(value)}) Tj`,
    "ET",
    "",
  ].join("\n");
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number],
) {
  return `${color.join(" ")} rg\n${x} ${y} ${width} ${height} re f\n`;
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number],
) {
  return `${color.join(" ")} RG\n1 w\n${x1} ${y1} m ${x2} ${y2} l S\n`;
}

function escapePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(value: string, maxLength: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 3);
}

function formatAmount(amountCents: number, currency: string) {
  return `${currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`;
}

function formatInvoiceDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatVatLabel(input: InvoicePdfInput) {
  const vatType = (input.vatType || "EXCLUSIVE").toUpperCase();
  const rateBps = input.vatRateBps ?? 0;
  const rate = rateBps / 100;
  const rateLabel = `${rate.toFixed(rateBps % 100 === 0 ? 0 : 2)}%`;
  const slabName = input.vatSlabName ? ` ${input.vatSlabName}` : "";

  if (vatType === "ZERO") {
    return "VAT 0%";
  }

  return `VAT ${rateLabel}${slabName}`;
}

function statusColor(status: InvoiceStatus | string): [number, number, number] {
  return status.toString().toUpperCase() === "PAID"
    ? [0.02, 0.5, 0.18]
    : [0.55, 0.35, 0.05];
}
