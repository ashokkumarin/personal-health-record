import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { createFamilySchema, addMemberSchema } from "@phr/shared";
import { prisma } from "../db.js";
import { hashPassword } from "../auth-utils.js";
import { authenticate } from "../plugins/authenticate.js";

async function requireManagerRole(familyId: string, userId: string) {
  const membership = await prisma.familyMembership.findFirst({
    where: { familyId, userId, deletedAt: null },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return null;
  }
  return membership;
}

function findActiveFamily(id: string) {
  return prisma.family.findFirst({ where: { id, deletedAt: null } });
}

export async function familiesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post("/families", async (request, reply) => {
    const parsed = createFamilySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    try {
      const family = await prisma.family.create({
        data: {
          name: parsed.data.name,
          ownerId: request.userId,
          memberships: {
            create: { userId: request.userId, role: "OWNER", status: "ACTIVE" },
          },
        },
      });

      return reply.code(201).send(family);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return reply.code(409).send({ error: "FAMILY_NAME_TAKEN" });
      }
      throw err;
    }
  });

  app.get("/families", async (request, reply) => {
    const memberships = await prisma.familyMembership.findMany({
      where: { userId: request.userId, deletedAt: null },
      include: { family: true },
    });
    return reply.send(
      memberships
        .filter((m) => m.family.deletedAt === null)
        .map((m) => ({ ...m.family, myRole: m.role }))
    );
  });

  app.get<{ Params: { id: string } }>("/families/:id", async (request, reply) => {
    const membership = await prisma.familyMembership.findFirst({
      where: { familyId: request.params.id, userId: request.userId, deletedAt: null },
    });
    if (!membership) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    const family = await prisma.family.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: {
        memberships: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        patients: { where: { deletedAt: null } },
      },
    });
    if (!family) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    return reply.send(family);
  });

  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    "/families/:id",
    async (request, reply) => {
      const requester = await requireManagerRole(request.params.id, request.userId);
      if (!requester) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }

      const family = await findActiveFamily(request.params.id);
      if (!family) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }

      const parsed = createFamilySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      }

      try {
        const updated = await prisma.family.update({
          where: { id: family.id },
          data: { name: parsed.data.name },
        });
        return reply.send(updated);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return reply.code(409).send({ error: "FAMILY_NAME_TAKEN" });
        }
        throw err;
      }
    }
  );

  app.delete<{ Params: { id: string } }>("/families/:id", async (request, reply) => {
    const requester = await requireManagerRole(request.params.id, request.userId);
    if (!requester) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    const family = await findActiveFamily(request.params.id);
    if (!family) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    await prisma.family.update({
      where: { id: family.id },
      data: { deletedAt: new Date() },
    });

    return reply.code(204).send();
  });

  app.post<{ Params: { id: string }; Body: { userId: string } }>(
    "/families/:id/admins",
    async (request, reply) => {
      const requester = await requireManagerRole(request.params.id, request.userId);
      if (!requester || requester.role !== "OWNER") {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }

      if (!(await findActiveFamily(request.params.id))) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }

      const target = await prisma.familyMembership.findFirst({
        where: { familyId: request.params.id, userId: request.body.userId, deletedAt: null },
      });
      if (!target) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }

      const updated = await prisma.familyMembership.update({
        where: { id: target.id },
        data: { role: "ADMIN" },
      });

      return reply.send(updated);
    }
  );

  app.post<{ Params: { id: string } }>("/families/:id/members", async (request, reply) => {
    const familyId = request.params.id;

    const requester = await requireManagerRole(familyId, request.userId);
    if (!requester) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }

    if (!(await findActiveFamily(familyId))) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    const parsed = addMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const input = parsed.data;
    const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : undefined;

    if (input.mode === "no_account") {
      const patient = await prisma.patientProfile.create({
        data: {
          familyId,
          name: input.name,
          dateOfBirth,
          gender: input.gender,
        },
      });
      return reply.code(201).send(patient);
    }

    if (input.mode === "new_account") {
      const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
      if (existingUser) {
        return reply.code(409).send({ error: "EMAIL_ALREADY_REGISTERED" });
      }

      const passwordHash = await hashPassword(input.password);
      const patient = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name: input.name, email: input.email, passwordHash },
        });
        await tx.familyMembership.create({
          data: { familyId, userId: user.id, role: "MEMBER", status: "ACTIVE", relation: input.relation },
        });
        return tx.patientProfile.create({
          data: {
            familyId,
            linkedUserId: user.id,
            name: input.name,
            dateOfBirth,
            gender: input.gender,
          },
        });
      });

      return reply.code(201).send(patient);
    }

    // mode === "link_existing"
    const existingUser = await prisma.user.findUnique({ where: { email: input.existingUserEmail } });
    if (!existingUser) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    const existingPatientProfile = await prisma.patientProfile.findUnique({
      where: { linkedUserId: existingUser.id },
    });
    if (existingPatientProfile) {
      return reply.code(409).send({ error: "ALREADY_LINKED" });
    }

    const existingMembership = await prisma.familyMembership.findFirst({
      where: { familyId, userId: existingUser.id, deletedAt: null },
    });
    if (existingMembership && existingMembership.userId !== request.userId) {
      return reply.code(409).send({ error: "ALREADY_MEMBER" });
    }

    // Self-service: the owner/admin already has an active FamilyMembership
    // (created with the family, or added earlier) but no patient profile yet —
    // linking themselves needs no approval and no new membership row.
    if (existingMembership && existingMembership.userId === request.userId) {
      const patient = await prisma.patientProfile.create({
        data: {
          familyId,
          linkedUserId: existingUser.id,
          name: input.name,
          dateOfBirth,
          gender: input.gender,
        },
      });
      return reply.code(201).send(patient);
    }

    const patient = await prisma.$transaction(async (tx) => {
      const createdPatient = await tx.patientProfile.create({
        data: {
          familyId,
          name: input.name,
          dateOfBirth,
          gender: input.gender,
        },
      });
      await tx.familyMembership.create({
        data: {
          familyId,
          userId: existingUser.id,
          role: "MEMBER",
          status: "PENDING",
          relation: input.relation,
        },
      });
      await tx.approvalRequest.create({
        data: {
          patientId: createdPatient.id,
          targetUserId: existingUser.id,
          requestedById: request.userId,
        },
      });
      return createdPatient;
    });

    return reply.code(201).send(patient);
  });

  app.delete<{ Params: { id: string; userId: string } }>(
    "/families/:id/members/:userId",
    async (request, reply) => {
      const requester = await requireManagerRole(request.params.id, request.userId);
      if (!requester) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }

      if (!(await findActiveFamily(request.params.id))) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }

      const target = await prisma.familyMembership.findFirst({
        where: { familyId: request.params.id, userId: request.params.userId, deletedAt: null },
      });
      if (!target) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }
      if (target.role === "OWNER") {
        return reply.code(400).send({ error: "CANNOT_REMOVE_OWNER" });
      }

      await prisma.familyMembership.update({
        where: { id: target.id },
        data: { deletedAt: new Date() },
      });

      return reply.code(204).send();
    }
  );
}
