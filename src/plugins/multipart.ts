import multipart from "@fastify/multipart";
import fp from "fastify-plugin";

export default fp(async (fastify) => {
  await fastify.register(multipart, {
    limits: {
      files: 1,
      fileSize: 25 * 1024 * 1024,
    },
  });
});
