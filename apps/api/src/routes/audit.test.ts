import { beforeEach, beforeAll, afterAll, describe, expect, it } from "vitest";
import FormData from "form-data";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";
import { registerUser, resetDb } from "../test-utils.js";
import { ensureMediaRoot } from "../storage.js";

const app = buildApp();

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

beforeAll(async () => {
  await ensureMediaRoot();
});

beforeEach(resetDb);

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function setupFamilyWithPatient(token: string) {
  const familyRes = await app.inject({
    method: "POST",
    url: "/families",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "The Guptas" },
  });
  const family = familyRes.json();

  const patientRes = await app.inject({
    method: "POST",
    url: `/families/${family.id}/members`,
    headers: { authorization: `Bearer ${token}` },
    payload: { mode: "no_account", name: "Baby Gupta", relation: "child" },
  });
  const patient = patientRes.json();

  return { family, patient };
}

async function uploadRecord(token: string, patientId: string, extraHeaders: Record<string, string> = {}) {
  const form = new FormData();
  form.append("recordType", "NOTE");
  form.append("title", "Audit test record");
  form.append("file", TINY_PNG, { filename: "f.png", contentType: "image/png" });
  const res = await app.inject({
    method: "POST",
    url: `/patients/${patientId}/records`,
    headers: { authorization: `Bearer ${token}`, ...form.getHeaders(), ...extraHeaders },
    payload: form.getBuffer(),
  });
  return res.json();
}

describe("audit logging", () => {
  it("registering creates a REGISTER audit row", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Asha", email: "asha@example.com", password: "password123" },
    });
    const userId = res.json().user.id;

    const rows = await prisma.auditLog.findMany({ where: { eventType: "REGISTER" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(userId);
    expect(rows[0].actorType).toBe("USER");
    expect(rows[0].source).toBe("API");
  });

  it("logging in creates a LOGIN audit row", async () => {
    const { user } = await registerUser(app, { email: "login-audit@example.com", password: "password123" });

    const rows = await prisma.auditLog.findMany({ where: { eventType: "LOGIN" } });
    // registerUser doesn't log in separately; login comes from the register call itself
    // being logged as REGISTER, so explicitly log in to produce a LOGIN row.
    expect(rows).toHaveLength(0);

    await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "login-audit@example.com", password: "password123" },
    });

    const loginRows = await prisma.auditLog.findMany({ where: { eventType: "LOGIN" } });
    expect(loginRows).toHaveLength(1);
    expect(loginRows[0].userId).toBe(user.id);
  });

  it("logging out requires auth and creates a LOGOUT audit row", async () => {
    const unauthorized = await app.inject({ method: "POST", url: "/auth/logout", payload: {} });
    expect(unauthorized.statusCode).toBe(401);

    const { user, token } = await registerUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);

    const rows = await prisma.auditLog.findMany({ where: { eventType: "LOGOUT" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(user.id);
  });

  it("uploading a record creates an UPLOAD audit row tagged with the patient", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const record = await uploadRecord(owner.token, patient.id);

    const rows = await prisma.auditLog.findMany({ where: { eventType: "UPLOAD" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(owner.user.id);
    expect(rows[0].entityType).toBe("record");
    expect(rows[0].entityId).toBe(record.id);
    const metadata = rows[0].metadata as { patientId?: string; title?: string } | null;
    expect(metadata?.patientId).toBe(patient.id);
    expect(metadata?.title).toBe("Audit test record");
  });

  it("editing a record creates an EDIT audit row with the record's id", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);
    const record = await uploadRecord(owner.token, patient.id);

    await app.inject({
      method: "PATCH",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: "Edited title" },
    });

    const rows = await prisma.auditLog.findMany({ where: { eventType: "EDIT" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].entityId).toBe(record.id);
    expect((rows[0].metadata as { title?: string } | null)?.title).toBe("Edited title");
  });

  it("deleting a record creates a DELETE audit row with the record's id and title", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);
    const record = await uploadRecord(owner.token, patient.id);

    await app.inject({
      method: "DELETE",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const rows = await prisma.auditLog.findMany({ where: { eventType: "DELETE" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].entityId).toBe(record.id);
    expect((rows[0].metadata as { title?: string } | null)?.title).toBe("Audit test record");
  });

  it("a rejected (403) request does not create an audit row", async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);
    const record = await uploadRecord(owner.token, patient.id);

    const res = await app.inject({
      method: "PATCH",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${stranger.token}` },
      payload: { title: "Hijacked" },
    });
    expect(res.statusCode).toBe(403);

    const rows = await prisma.auditLog.findMany({ where: { eventType: "EDIT" } });
    expect(rows).toHaveLength(0);
  });

  it("tags the audit row's source from the X-Client header", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    await uploadRecord(owner.token, patient.id, { "x-client": "mobile" });

    const rows = await prisma.auditLog.findMany({ where: { eventType: "UPLOAD" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("MOBILE");
  });
});
