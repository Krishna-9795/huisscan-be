import { createHash, createHmac, randomUUID } from "crypto";

import { env } from "../config/env";

type EmailAttachment = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

type SendSesEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
  from?: string;
};

export async function sendSesEmail(input: SendSesEmailInput) {
  const config = getSesConfig(input.from);
  const rawEmail = buildRawEmail({
    from: config.senderEmail,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments || [],
  });
  const body = new URLSearchParams({
    Action: "SendRawEmail",
    Version: "2010-12-01",
    "RawMessage.Data": Buffer.from(rawEmail, "utf8").toString("base64"),
  }).toString();
  const amzDate = toAmzDate(new Date());
  const host = `email.${config.region}.amazonaws.com`;
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    Host: host,
    "X-Amz-Date": amzDate,
  };

  if (config.sessionToken) {
    headers["X-Amz-Security-Token"] = config.sessionToken;
  }

  headers.Authorization = signSesRequest({
    body,
    headers,
    host,
    amzDate,
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });

  const response = await fetch(`https://${host}/`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(
      `SES email failed with HTTP ${response.status}${responseBody ? `: ${responseBody}` : ""}`,
    );
  }
}

function getSesConfig(senderEmail?: string) {
  const accessKeyId = env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
  const region = env.AWS_USER_REGION;
  const configuredSenderEmail = senderEmail || env.SENDER_EMAIL;

  if (!accessKeyId || !secretAccessKey || !region || !configuredSenderEmail) {
    const missing = [
      ["AWS_ACCESS_KEY_ID", accessKeyId],
      ["AWS_SECRET_ACCESS_KEY", secretAccessKey],
      ["AWS_USER_REGION", region],
      ["SENDER_EMAIL", configuredSenderEmail],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    throw new Error(`Missing SES environment variables: ${missing.join(", ")}`);
  }

  return {
    accessKeyId,
    secretAccessKey,
    region,
    senderEmail: configuredSenderEmail,
    sessionToken: env.AWS_SESSION_TOKEN,
  };
}

function buildRawEmail(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments: EmailAttachment[];
}) {
  const mixedBoundary = `mixed-${randomUUID()}`;
  const alternativeBoundary = `alt-${randomUUID()}`;
  const headers = [
    `From: ${formatAddress(input.from)}`,
    `To: ${formatAddress(input.to)}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ];
  const parts = [
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    toQuotedPrintable(input.text),
  ];

  if (input.html) {
    parts.push(
      `--${alternativeBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: quoted-printable",
      "",
      toQuotedPrintable(input.html),
    );
  }

  parts.push(`--${alternativeBoundary}--`);

  for (const attachment of input.attachments) {
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.contentType}; name="${escapeMimeParam(attachment.filename)}"`,
      `Content-Disposition: attachment; filename="${escapeMimeParam(attachment.filename)}"`,
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(attachment.contentBase64),
    );
  }

  parts.push(`--${mixedBoundary}--`, "");

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}

function signSesRequest(input: {
  body: string;
  headers: Record<string, string>;
  host: string;
  amzDate: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}) {
  const dateStamp = input.amzDate.slice(0, 8);
  const headerNames = Object.keys(input.headers)
    .map((name) => name.toLowerCase())
    .sort();
  const canonicalHeaders = headerNames
    .map((name) => `${name}:${input.headers[findHeaderKey(input.headers, name)].trim()}\n`)
    .join("");
  const signedHeaders = headerNames.join(";");
  const credentialScope = `${dateStamp}/${input.region}/ses/aws4_request`;
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256Hex(input.body),
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    input.amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = getSignatureKey(
    input.secretAccessKey,
    dateStamp,
    input.region,
    "ses",
  );
  const signature = hmacHex(signingKey, stringToSign);

  return [
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");
}

function findHeaderKey(headers: Record<string, string>, lowerName: string) {
  const key = Object.keys(headers).find((name) => name.toLowerCase() === lowerName);

  if (!key) {
    throw new Error(`Missing signed header: ${lowerName}`);
  }

  return key;
}

function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
) {
  const kDate = hmacBuffer(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacBuffer(kDate, region);
  const kService = hmacBuffer(kRegion, service);
  return hmacBuffer(kService, "aws4_request");
}

function hmacBuffer(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function formatAddress(email: string) {
  return `<${email}>`;
}

function escapeMimeParam(value: string) {
  return value.replace(/[\\"]/g, "\\$&");
}

function wrapBase64(value: string) {
  const cleanValue = value.replace(/\s+/g, "");
  return cleanValue.match(/.{1,76}/g)?.join("\r\n") || "";
}

function toQuotedPrintable(value: string) {
  return value
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) =>
      Array.from(Buffer.from(line, "utf8"))
        .map((byte) => {
          if (byte === 0x09 || (byte >= 0x20 && byte <= 0x7e && byte !== 0x3d)) {
            return String.fromCharCode(byte);
          }

          return `=${byte.toString(16).toUpperCase().padStart(2, "0")}`;
        })
        .join(""),
    )
    .join("\r\n");
}
