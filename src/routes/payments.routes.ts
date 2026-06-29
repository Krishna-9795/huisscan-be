import { FastifyInstance } from "fastify";

import {
  createMolliePayment,
  handleMollieReturn,
  handleMollieWebhook,
} from "../controllers/payments.controller";

export default async function paymentsRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(String(body))));
    },
  );

  app.addContentTypeParser(
    /^multipart\/form-data(?:;.*)?$/i,
    { parseAs: "buffer" },
    (request, body, done) => {
      try {
        done(
          null,
          parseMultipartFormFields(String(request.headers["content-type"]), body),
        );
      } catch (error) {
        done(error as Error);
      }
    },
  );

  app.post("/mollie/create", createMolliePayment);
  app.get("/mollie/return", handleMollieReturn);
  app.post("/mollie/webhook", handleMollieWebhook);
}

function parseMultipartFormFields(contentType: string, body: string | Buffer) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundary) {
    throw new Error("Missing multipart form boundary");
  }

  const fields: Record<string, string> = {};
  const rawBody = Buffer.isBuffer(body) ? body.toString("utf8") : body;
  const delimiter = `--${boundary}`;

  for (const part of rawBody.split(delimiter)) {
    if (!part || part === "--\r\n" || part === "--") {
      continue;
    }

    const [rawHeaders, ...bodyParts] = part.split("\r\n\r\n");
    const value = bodyParts
      .join("\r\n\r\n")
      .replace(/\r\n--$/, "")
      .replace(/\r\n$/, "");
    const name = rawHeaders.match(
      /content-disposition:[^\r\n]*\bname="([^"]+)"/i,
    )?.[1];
    const filename = rawHeaders.match(/content-disposition:[^\r\n]*\bfilename="/i);

    if (name && !filename) {
      fields[name] = value;
    }
  }

  return fields;
}
