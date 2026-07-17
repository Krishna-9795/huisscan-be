import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import {
  UnsupportedFileTypeError,
  UploadsService,
} from "../services/uploads.service";

export async function uploadFile(request: FastifyRequest, reply: FastifyReply) {
  const file = await request.file();

  if (!file) {
    throw request.server.httpErrors.badRequest("File is required");
  }

  try {
    const buffer = await file.toBuffer();
    const uploadsService = new UploadsService();
    const uploadedFile = await uploadsService.uploadFile({
      buffer,
      filename: file.filename,
      mimetype: file.mimetype,
    });

    return reply
      .status(201)
      .send(successResponse(uploadedFile, "File uploaded successfully"));
  } catch (error) {
    if (error instanceof UnsupportedFileTypeError) {
      throw request.server.httpErrors.badRequest(error.message);
    }

    throw error;
  }
}
