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

async function createFamily(token: string, name = "The Kumars") {
  const res = await app.inject({
    method: "POST",
    url: "/families",
    headers: { authorization: `Bearer ${token}` },
    payload: { name },
  });
  return res;
}

describe("POST /families", () => {
  it("creator becomes OWNER with an ACTIVE membership (AC1)", async () => {
    const { token, user } = await registerUser(app);

    const res = await createFamily(token);
    expect(res.statusCode).toBe(201);

    const membership = await prisma.familyMembership.findFirst({
      where: { familyId: res.json().id, userId: user.id },
    });
    expect(membership?.role).toBe("OWNER");
    expect(membership?.status).toBe("ACTIVE");
  });

  it("rejects a family name that is already taken", async () => {
    const owner = await registerUser(app);
    const anotherUser = await registerUser(app);

    const first = await createFamily(owner.token, "The Duplicates");
    expect(first.statusCode).toBe(201);

    const second = await createFamily(anotherUser.token, "The Duplicates");
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("FAMILY_NAME_TAKEN");
  });
});

describe("GET /families (myRole)", () => {
  it("returns the caller's own role for each family", async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { mode: "link_existing", name: "Member One", existingUserEmail: member.user.email },
    });
    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { targetUserId: member.user.id },
    });
    await app.inject({
      method: "POST",
      url: `/approval-requests/${approval.id}/approve`,
      headers: { authorization: `Bearer ${member.token}` },
    });
    await app.inject({
      method: "POST",
      url: `/families/${family.id}/admins`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { userId: member.user.id },
    });

    const ownerList = await app.inject({
      method: "GET",
      url: "/families",
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(ownerList.json().find((f: { id: string }) => f.id === family.id).myRole).toBe("OWNER");

    const memberList = await app.inject({
      method: "GET",
      url: "/families",
      headers: { authorization: `Bearer ${member.token}` },
    });
    expect(memberList.json().find((f: { id: string }) => f.id === family.id).myRole).toBe("ADMIN");
  });
});

describe("POST /families/:id/admins", () => {
  it("owner can promote an existing member to ADMIN (AC2)", async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { mode: "link_existing", name: "Member One", existingUserEmail: member.user.email },
    });
    await prisma.familyMembership.updateMany({
      where: { familyId: family.id, userId: member.user.id },
      data: { status: "ACTIVE" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/families/${family.id}/admins`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { userId: member.user.id },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("ADMIN");
  });

  it("non-owner promoting another member gets 403 (AC2, AC8)", async () => {
    const owner = await registerUser(app);
    const notOwner = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    const res = await app.inject({
      method: "POST",
      url: `/families/${family.id}/admins`,
      headers: { authorization: `Bearer ${notOwner.token}` },
      payload: { userId: owner.user.id },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("POST /families/:id/members", () => {
  it("mode no_account creates a patient profile with no linked user (AC3)", async () => {
    const owner = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    const res = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { mode: "no_account", name: "Baby Kumar", relation: "child" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().linkedUserId).toBeNull();
  });

  it("mode new_account creates a user, active membership, and linked patient (AC4)", async () => {
    const owner = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    const res = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        mode: "new_account",
        name: "Grandma Kumar",
        email: "grandma@example.com",
        password: "password123",
      },
    });

    expect(res.statusCode).toBe(201);
    const patient = res.json();
    expect(patient.linkedUserId).not.toBeNull();

    const membership = await prisma.familyMembership.findFirst({
      where: { familyId: family.id, userId: patient.linkedUserId },
    });
    expect(membership?.status).toBe("ACTIVE");

    const approvalCount = await prisma.approvalRequest.count();
    expect(approvalCount).toBe(0);
  });

  it("mode link_existing creates a pending approval and pending membership, patient unlinked (AC5)", async () => {
    const owner = await registerUser(app);
    const existing = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    const res = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        mode: "link_existing",
        name: "Uncle Kumar",
        existingUserEmail: existing.user.email,
      },
    });

    expect(res.statusCode).toBe(201);
    const patient = res.json();
    expect(patient.linkedUserId).toBeNull();

    const membership = await prisma.familyMembership.findFirst({
      where: { familyId: family.id, userId: existing.user.id },
    });
    expect(membership?.status).toBe("PENDING");

    const approval = await prisma.approvalRequest.findFirst({
      where: { patientId: patient.id },
    });
    expect(approval?.status).toBe("PENDING");
    expect(approval?.targetUserId).toBe(existing.user.id);
  });

  it("non-owner/non-admin adding a member gets 403 (AC8)", async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    const res = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${stranger.token}` },
      payload: { mode: "no_account", name: "Baby Kumar" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("adding the same user twice returns 409 (AC9)", async () => {
    const owner = await registerUser(app);
    const existing = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { mode: "link_existing", name: "Uncle Kumar", existingUserEmail: existing.user.email },
    });

    const res = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { mode: "link_existing", name: "Uncle Kumar Again", existingUserEmail: existing.user.email },
    });

    expect(res.statusCode).toBe(409);
  });

  it("owner can link themselves to a patient profile in their own family, no approval needed", async () => {
    const owner = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    const res = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        mode: "link_existing",
        name: owner.user.name,
        existingUserEmail: owner.user.email,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().linkedUserId).toBe(owner.user.id);

    const membership = await prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId: family.id, userId: owner.user.id } },
    });
    expect(membership?.role).toBe("OWNER");
    expect(membership?.status).toBe("ACTIVE");

    const approvalCount = await prisma.approvalRequest.count();
    expect(approvalCount).toBe(0);
  });

  it("linking a user who already has a patient profile elsewhere gets 409", async () => {
    const owner = await registerUser(app);
    const existing = await registerUser(app);
    const firstFamily = (await createFamily(owner.token, "First Family")).json();
    const secondFamily = (await createFamily(owner.token, "Second Family")).json();

    await app.inject({
      method: "POST",
      url: `/families/${firstFamily.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { mode: "new_account", name: "Linked Person", email: "linked.person@example.com", password: "password123" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/families/${secondFamily.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        mode: "link_existing",
        name: "Linked Person Again",
        existingUserEmail: "linked.person@example.com",
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("ALREADY_LINKED");
  });
});

describe("DELETE /families/:id/members/:userId", () => {
  async function setupActiveMember(ownerToken: string, familyId: string) {
    const member = await registerUser(app);
    await app.inject({
      method: "POST",
      url: `/families/${familyId}/members`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { mode: "link_existing", name: "Member One", existingUserEmail: member.user.email },
    });
    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { targetUserId: member.user.id },
    });
    await app.inject({
      method: "POST",
      url: `/approval-requests/${approval.id}/approve`,
      headers: { authorization: `Bearer ${member.token}` },
    });
    return member;
  }

  it("owner can remove a non-owner member; their patient profile stays", async () => {
    const owner = await registerUser(app);
    const family = (await createFamily(owner.token)).json();
    const member = await setupActiveMember(owner.token, family.id);

    const res = await app.inject({
      method: "DELETE",
      url: `/families/${family.id}/members/${member.user.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(res.statusCode).toBe(204);

    const membership = await prisma.familyMembership.findUnique({
      where: { familyId_userId: { familyId: family.id, userId: member.user.id } },
    });
    expect(membership).not.toBeNull();
    expect(membership?.deletedAt).not.toBeNull();

    const patient = await prisma.patientProfile.findFirst({
      where: { familyId: family.id, linkedUserId: member.user.id },
    });
    expect(patient).not.toBeNull();
  });

  it("removing the OWNER is rejected with 400", async () => {
    const owner = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    const res = await app.inject({
      method: "DELETE",
      url: `/families/${family.id}/members/${owner.user.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("CANNOT_REMOVE_OWNER");
  });

  it("non-owner/non-admin removing a member gets 403", async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const family = (await createFamily(owner.token)).json();
    const member = await setupActiveMember(owner.token, family.id);

    const res = await app.inject({
      method: "DELETE",
      url: `/families/${family.id}/members/${member.user.id}`,
      headers: { authorization: `Bearer ${stranger.token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("removing a user who isn't a member of the family gets 404", async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    const res = await app.inject({
      method: "DELETE",
      url: `/families/${family.id}/members/${stranger.user.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /families/:id (rename)", () => {
  it("owner/admin can rename a family", async () => {
    const owner = await registerUser(app);
    const family = (await createFamily(owner.token, "Old Name")).json();

    const res = await app.inject({
      method: "PATCH",
      url: `/families/${family.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: "New Name" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("New Name");
  });

  it("renaming to a name already taken by another family gets 409", async () => {
    const owner = await registerUser(app);
    await createFamily(owner.token, "Taken Name");
    const family = (await createFamily(owner.token, "Original Name")).json();

    const res = await app.inject({
      method: "PATCH",
      url: `/families/${family.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: "Taken Name" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("FAMILY_NAME_TAKEN");
  });

  it("non-owner/non-admin renaming a family gets 403", async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    const res = await app.inject({
      method: "PATCH",
      url: `/families/${family.id}`,
      headers: { authorization: `Bearer ${stranger.token}` },
      payload: { name: "Hijacked" },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("DELETE /families/:id (soft delete)", () => {
  it("owner/admin can delete a family; it disappears from lists but its data remains", async () => {
    const owner = await registerUser(app);
    const family = (await createFamily(owner.token)).json();
    const patientRes = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { mode: "no_account", name: "Baby Kumar" },
    });
    const patient = patientRes.json();

    const res = await app.inject({
      method: "DELETE",
      url: `/families/${family.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(res.statusCode).toBe(204);

    const detail = await app.inject({
      method: "GET",
      url: `/families/${family.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(detail.statusCode).toBe(404);

    const list = await app.inject({
      method: "GET",
      url: "/families",
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(list.json().find((f: { id: string }) => f.id === family.id)).toBeUndefined();

    const stillExists = await prisma.patientProfile.findUnique({ where: { id: patient.id } });
    expect(stillExists).not.toBeNull();
  });

  it("non-owner/non-admin deleting a family gets 403", async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    const res = await app.inject({
      method: "DELETE",
      url: `/families/${family.id}`,
      headers: { authorization: `Bearer ${stranger.token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("deleting an already-deleted family gets 404", async () => {
    const owner = await registerUser(app);
    const family = (await createFamily(owner.token)).json();

    await app.inject({
      method: "DELETE",
      url: `/families/${family.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/families/${family.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("a name freed up by deleting a family can be reused", async () => {
    const owner = await registerUser(app);
    const family = (await createFamily(owner.token, "Reusable Name")).json();

    await app.inject({
      method: "DELETE",
      url: `/families/${family.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const res = await createFamily(owner.token, "Reusable Name");

    expect(res.statusCode).toBe(201);
  });
});

describe("authentication (AC10)", () => {
  it("unauthenticated requests to family routes get 401", async () => {
    const res = await app.inject({ method: "POST", url: "/families", payload: { name: "X" } });
    expect(res.statusCode).toBe(401);
  });
});
