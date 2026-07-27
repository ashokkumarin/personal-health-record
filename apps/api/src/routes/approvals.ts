m type { FastifyInstance } from "fastify";
m { prisma } from "../db.js";
m { authenticate } from "../plugins/authenticate.js";

export async function approvalsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/approval-requests", async (request, reply) => {
    const requests = await prisma.approvalRequest.findMany({
      where: { targetUserId: request.userId, status: "PENDING" },
      include: { patient: true },
    });
    return reply.send(requests);
  });

  app.post<{ Params: { id: string } }>("/approval-requests/:id/approve", async (request, reply) => {
    const approval = await prisma.approvalRequest.findUnique({ where: { id: request.params.id } });
    if (!approval) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    if (approval.targetUserId !== request.userId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.patientProfile.update({
        where: { id: approval.patientId },
        data: { linkedUserId: approval.targetUserId },
      });
      const patient = await tx.patientProfile.findUniqueOrThrow({ where: { id: approval.patientId } });
      await tx.familyMembership.updateMany({
        where: { familyId: patient.familyId, userId: approval.targetUserId },
        data: { status: "ACTIVE" },
      });
      return tx.approvalRequest.update({
        where: { id: approval.id },
        data: { status: "APPROVED", respondedAt: new Date() },
      });
    });

    return reply.send(updated);
  });

  app.post<{ Params: { id: string } }>("/approval-requests/:id/reject", async (request, reply) => {
    const approval = await prisma.approvalRequest.findUnique({ where: { id: request.params.id } });
    if (!approval) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    if (approval.targetUserId !== request.userId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const patient = await tx.patientProfile.findUniqueOrThrow({ where: { id: approval.patientId } });
      await tx.familyMembership.deleteMany({
        where: { familyId: patient.familyId, userId: approval.targetUserId, status: "PENDING" },
      });
      return tx.approvalRequest.update({
        where: { id: approval.id },
        data: { status: "REJECTED", respondedAt: new Date() },
      });
    });

    return reply.send(updated);
  });
}
