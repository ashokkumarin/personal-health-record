import type { FastifyInstance } from "fastify";
import { prisma } from "./db.js";

export async function resetDb() {
  await prisma.medicalRecord.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.familyMembership.deleteMany();
  await prisma.family.deleteMany();
  await prisma.user.deleteMany();
}

let counter = 0;

export async function registerUser(
  app: FastifyInstance,
  overrides: Partial<{ name: string; email: string; password: string }> = {}
) {
  counter += 1;
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      name: overrides.name ?? `Test User ${counter}`,
      email: overrides.email ?? `test-user-${counter}@example.com`,
      password: overrides.password ?? "password123",
    },
  });

  const body = res.json();
  return { user: body.user, token: body.token as string };
}
