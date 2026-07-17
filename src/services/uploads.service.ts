import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "../config/env";

const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);
const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];

export type UploadFileInput = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
};

export type UploadedFile = {
  key: string;
  bucket: string;
  originalFilename: string;
  contentType: string;
  size: number;
};

export class UploadsService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    const config = getS3Config();

    this.bucketName = config.bucketName;
    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async uploadFile(input: UploadFileInput): Promise<UploadedFile> {
    if (!isAllowedMimeType(input.mimetype)) {
      throw new UnsupportedFileTypeError(input.mimetype);
    }

    const key = createUploadKey(input.filename);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimetype,
      }),
    );

    return {
      key,
      bucket: this.bucketName,
      originalFilename: input.filename,
      contentType: input.mimetype,
      size: input.buffer.length,
    };
  }
}

export class UnsupportedFileTypeError extends Error {
  constructor(mimetype: string) {
    super(`Unsupported file type: ${mimetype}`);
  }
}

function getS3Config() {
  const accessKeyId = env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
  const region = env.AWS_USER_REGION;
  const bucketName = env.AWS_STORAGE_BUCKET_NAME;

  if (!accessKeyId || !secretAccessKey || !region || !bucketName) {
    const missing = [
      ["AWS_ACCESS_KEY_ID", accessKeyId],
      ["AWS_SECRET_ACCESS_KEY", secretAccessKey],
      ["AWS_USER_REGION", region],
      ["AWS_STORAGE_BUCKET_NAME", bucketName],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    throw new Error(`Missing S3 environment variables: ${missing.join(", ")}`);
  }

  return {
    accessKeyId,
    secretAccessKey,
    region,
    bucketName,
  };
}

function isAllowedMimeType(mimetype: string) {
  return (
    ALLOWED_MIME_TYPES.has(mimetype) ||
    ALLOWED_MIME_PREFIXES.some((prefix) => mimetype.startsWith(prefix))
  );
}

function createUploadKey(filename: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeFilename = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `uploads/${timestamp}-${randomUUID()}-${safeFilename || "file"}`;
}
