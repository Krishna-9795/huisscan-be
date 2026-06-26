import sensible from "@fastify/sensible";
import fp from "fastify-plugin";

export default fp(async (fastify) => {
  await fastify.register(sensible);

  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      success: false,
      message: "Route not found",
    });
  });
});
