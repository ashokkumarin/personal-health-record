import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";
import { registerAdmin, registerUser, resetDb } from "../test-utils.js";

const app = buildApp();

beforeEach(resetDb);

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe("admin authorization", () => {
  it("rejects non-admin users with 403", async () => {
    const { token } = await registerUser(app);
    const res = await app.inject({ method: "GET", url: "/admin/users", headers: auth(token) });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("FORBIDDEN");
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/users" });
    expect(res.statusCode).toBe(401);
  });

  it("allows admins", async () => {
    const { token } = await registerAdmin(app);
    const res = await app.inject({ method: "GET", url: "/admin/users", headers: auth(token) });
    expect(res.statusCode).toBe(200);
  });
});

describe("POST /admin/users", () => {
  it("creates a user with forceChangePassword set", async () => {
    const { token: adminToken } = await registerAdmin(app);

    const res = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: auth(adminToken),
      payload: {
        name: "New Hire",
        email: "newhire@example.com",
        password: "temp12345",
        forceChangePassword: true,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().mustChangePassword).toBe(true);

    const audit = await prisma.auditLog.findFirst({ where: { eventType: "ADMIN_CREATE_USER" } });
    expect(audit).not.toBeNull();
  });

  it("rejects a duplicate email with 409", async () => {
    const { token: adminToken } = await registerAdmin(app);
    await registerUser(app, { email: "taken@example.com" });

    const res = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: auth(adminToken),
      payload: {
        name: "Dup",
        email: "taken@example.com",
        password: "password123",
        forceChangePassword: false,
      },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe("PATCH /admin/users/:id", () => {
  it("updates a user's profile fields", async () => {
    const { token: adminToken } = await registerAdmin(app);
    const { user } = await registerUser(app);

    const res = await app.inject({
      method: "PATCH",
      url: `/admin/users/${user.id}`,
      headers: auth(adminToken),
      payload: { name: "Renamed" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Renamed");
  });
});

describe("POST /admin/users/:id/reset-password", () => {
  it("sets a new password and forces change on next login", async () => {
    const { token: adminToken } = await registerAdmin(app);
    const { user } = await registerUser(app, { email: "reset-me@example.com" });

    const res = await app.inject({
      method: "POST",
      url: `/admin/users/${user.id}/reset-password`,
      headers: auth(adminToken),
      payload: { newPassword: "brandnewpass1" },
    });
    expect(res.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "reset-me@example.com", password: "brandnewpass1" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.mustChangePassword).toBe(true);
  });
});

describe("DELETE /admin/users/:id", () => {
  it("blocks self-deletion", async () => {
    const { token: adminToken, user: admin } = await registerAdmin(app);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/users/${admin.id}`,
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("CANNOT_DELETE_SELF");
  });

  it("blocks deleting another admin — admin accounts are root-like and untouchable from the panel", async () => {
    const { user: admin } = await registerAdmin(app);
    const { token: secondAdminToken } = await registerAdmin(app, {
      email: "second-admin@example.com",
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/admin/users/${admin.id}`,
      headers: auth(secondAdminToken),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("CANNOT_MODIFY_ADMIN");
  });

  it("blocks editing another admin", async () => {
    const { user: admin } = await registerAdmin(app);
    const { token: secondAdminToken } = await registerAdmin(app, {
      email: "second-admin@example.com",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/admin/users/${admin.id}`,
      headers: auth(secondAdminToken),
      payload: { name: "Hijacked" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("CANNOT_MODIFY_ADMIN");
  });

  it("blocks deleting a user who owns a family with other active members", async () => {
    const { token: adminToken } = await registerAdmin(app);
    const owner = await registerUser(app, { email: "owner@example.com" });
    const member = await registerUser(app, { email: "member@example.com" });

    const family = await app.inject({
      method: "POST",
      url: "/families",
      headers: auth(owner.token),
      payload: { name: "The Owners" },
    });
    const familyId = family.json().id;

    await app.inject({
      method: "POST",
      url: `/families/${familyId}/members`,
      headers: auth(owner.token),
      payload: {
        mode: "link_existing",
        existingUserEmail: "member@example.com",
        name: "Member",
        relation: "sibling",
      },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/admin/users/${owner.user.id}`,
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("CANNOT_REMOVE_OWNER");
  });

  it("cascades a solo user's family, patient profile, and records on delete", async () => {
    const { token: adminToken } = await registerAdmin(app);
    const solo = await registerUser(app, { email: "solo@example.com" });

    const family = await app.inject({
      method: "POST",
      url: "/families",
      headers: auth(solo.token),
      payload: { name: "Solo Family" },
    });
    const familyId = family.json().id;

    await app.inject({
      method: "POST",
      url: `/families/${familyId}/members`,
      headers: auth(solo.token),
      payload: { mode: "no_account", name: "Solo Self" },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/admin/users/${solo.user.id}`,
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(204);

    const deletedUser = await prisma.user.findUnique({ where: { id: solo.user.id } });
    expect(deletedUser?.deletedAt).not.toBeNull();

    const deletedFamily = await prisma.family.findUnique({ where: { id: familyId } });
    expect(deletedFamily?.deletedAt).not.toBeNull();

    const membership = await prisma.familyMembership.findFirst({
      where: { familyId, userId: solo.user.id },
    });
    expect(membership?.deletedAt).not.toBeNull();

    const auditEntry = await prisma.auditLog.findFirst({
      where: { eventType: "ADMIN_DELETE_USER", entityId: solo.user.id },
    });
    expect(auditEntry).not.toBeNull();

    // Deleted users can no longer log in.
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "solo@example.com", password: "password123" },
    });
    expect(login.statusCode).toBe(401);
  });
});

describe("GET /admin/audit-log", () => {
  it("lists audit entries newest first", async () => {
    const { token: adminToken } = await registerAdmin(app);
    await registerUser(app, { email: "a@example.com" });
    await registerUser(app, { email: "b@example.com" });

    const res = await app.inject({
      method: "GET",
      url: "/admin/audit-log",
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.entries.length).toBeGreaterThanOrEqual(2);
    const times = body.entries.map((e: { createdAt: string }) => new Date(e.createdAt).getTime());
    expect([...times]).toEqual([...times].sort((a, b) => b - a));
  });
});

describe("forgot password + admin resolve", () => {
  it("queues a request that the admin can resolve", async () => {
    const { token: adminToken } = await registerAdmin(app);
    const { user } = await registerUser(app, { email: "forgetful@example.com" });

    const forgot = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "forgetful@example.com" },
    });
    expect(forgot.statusCode).toBe(200);
    expect(forgot.json()).toEqual({ ok: true });

    const list = await app.inject({
      method: "GET",
      url: "/admin/password-reset-requests",
      headers: auth(adminToken),
    });
    expect(list.statusCode).toBe(200);
    const [request] = list.json();
    expect(request.userId).toBe(user.id);
    expect(request.status).toBe("PENDING");

    const resolve = await app.inject({
      method: "POST",
      url: `/admin/password-reset-requests/${request.id}/resolve`,
      headers: auth(adminToken),
      payload: { newPassword: "resolvedpass1" },
    });
    expect(resolve.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "forgetful@example.com", password: "resolvedpass1" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.mustChangePassword).toBe(true);
  });

  it("responds ok:true even for an unknown email, without creating a request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "nobody@example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(await prisma.passwordResetRequest.count()).toBe(0);
  });
});
