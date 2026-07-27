import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";
import { registerUser, resetDb } from "../test-utils.js";

const app = buildApp();

beforeEach(resetDb);

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function setupPendingApproval() {
  const owner = await registerUser(app);
  const target = await registerUser(app);

  const familyRes = await app.inject({
    method: "POST",
    url: "/families",
    headers: { authorization: `Bearer ${owner.token}` },
    payload: { name: "The Kumars" },
  });
  const family = familyRes.json();

  const memberRes = await app.inject({
    method: "POST",
    url: `/families/${family.id}/members`,
    headers: { authorization: `Bearer ${owner.token}` },
    payload: { mode: "link_existing", name: "Uncle Kumar", existingUserEmail: target.user.email },
  });
  const patient = memberRes.json();

  const approval = await prisma.approvalRequest.findFirstOrThrow({
    where: { patientId: patient.id },
  });

  return { owner, target, family, patient, approval };
}

describe("POST /approval-requests/:id/approve", () => {
  it("target user approving links the patient and activates membership (AC6)", async () => {
    const { target, family, patient, approval } = await setupPendingApproval();

    const res = await app.inject({
      method: "POST",
      url: `/approval-requests/${approval.id}/approve`,
      headers: { authorization: `Bearer ${target.token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("APPROVED");

    const updatedPatient = await prisma.patientProfile.findUniqueOrThrow({ where: { id: patient.id } });
    expect(updatedPatient.linkedUserId).toBe(target.user.id);

    const membership = await prisma.familyMembership.findFirstOrThrow({
      where: { familyId: family.id, userId: target.user.id },
    });
    expect(membership.status).toBe("ACTIVE");
  });

  it("a user who isn't the target gets 403", async () => {
    const { owner, approval } = await setupPendingApproval();

    const res = await app.inject({
      method: "POST",
      url: `/approval-requests/${approval.id}/approve`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("POST /approval-requests/:id/reject", () => {
  it("target user rejecting leaves the patient unlinked and removes the membership (AC7)", async () => {
    const { target, family, patient, approval } = await setupPendingApproval();

    const res = await app.inject({
      method: "POST",
      url: `/approval-requests/${approval.id}/reject`,
      headers: { authorization: `Bearer ${target.token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("REJECTED");

    const updatedPatient = await prisma.patientProfile.findUniqueOrThrow({ where: { id: patient.id } });
    expect(updatedPatient.linkedUserId).toBeNull();

    const membership = await prisma.familyMembership.findFirst({
      where: { familyId: family.id, userId: target.user.id },
    });
    expect(membership).toBeNull();
  });
});
