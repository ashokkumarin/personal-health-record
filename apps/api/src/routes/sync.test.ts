import { beforeEach, afterAll, describe, expect, it } from "vitest";
import FormData from "form-data";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";
import { registerUser, resetDb } from "../test-utils.js";

const app = buildApp();

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

async function uploadRecord(token: string, patientId: string) {
  const form = new FormData();
  form.append("recordType", "NOTE");
  form.append("title", "Sync test");
  form.append("file", TINY_PNG, { filename: "f.png", contentType: "image/png" });
  const res = await app.inject({
    method: "POST",
    url: `/patients/${patientId}/records`,
    headers: { authorization: `Bearer ${token}`, ...form.getHeaders() },
    payload: form.getBuffer(),
  });
  return res.json();
}

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

function pull(token: string, deviceId: string, since?: string) {
  const params = new URLSearchParams({ deviceId });
  if (since) params.set("since", since);
  return app.inject({
    method: "GET",
    url: `/sync/pull?${params.toString()}`,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("GET /sync/pull", () => {
  it("returns a full snapshot scoped to the caller's families when since is omitted", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);

    const res = await pull(owner.token, "device-1");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.families.map((f: { id: string }) => f.id)).toContain(family.id);
    expect(body.patients.map((p: { id: string }) => p.id)).toContain(patient.id);
    expect(typeof body.serverTime).toBe("string");
  });

  it("excludes families/patients the caller isn't a member of", async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const { family } = await setupFamilyWithPatient(owner.token);

    const res = await pull(stranger.token, "device-2");
    const body = res.json();
    expect(body.families.map((f: { id: string }) => f.id)).not.toContain(family.id);
  });

  it("only returns rows updated after the since cursor", async () => {
    const owner = await registerUser(app);
    await setupFamilyWithPatient(owner.token);

    const first = await pull(owner.token, "device-1");
    const cursor = first.json().serverTime;

    const second = await pull(owner.token, "device-1", cursor);
    expect(second.json().families).toHaveLength(0);
    expect(second.json().patients).toHaveLength(0);
  });

  it("tags a soft-deleted record as deleted:true", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const record = await uploadRecord(owner.token, patient.id);

    await app.inject({
      method: "DELETE",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const res = await pull(owner.token, "device-1");
    const found = res.json().records.find((r: { id: string }) => r.id === record.id);
    expect(found).toBeDefined();
    expect(found.deleted).toBe(true);
  });
});

describe("POST /sync/push", () => {
  it("creates a record from an offline mutation and is idempotent on retry", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);
    const clientId = "mut-1";
    const recordId = "11111111-1111-1111-1111-111111111111";

    const mutation = {
      deviceId: "device-1",
      mutations: [
        {
          clientId,
          entity: "record",
          op: "create",
          data: {
            id: recordId,
            patientId: patient.id,
            recordType: "NOTE",
            title: "Offline note",
            fileType: "image/png",
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    const res = await app.inject({
      method: "POST",
      url: "/sync/push",
      headers: { authorization: `Bearer ${owner.token}` },
      payload: mutation,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([{ clientId, status: "applied" }]);

    const created = await prisma.medicalRecord.findUnique({ where: { id: recordId } });
    expect(created).not.toBeNull();
    expect(created?.title).toBe("Offline note");

    // Retry the exact same push (simulating a network-retry) should be a no-op.
    const retry = await app.inject({
      method: "POST",
      url: "/sync/push",
      headers: { authorization: `Bearer ${owner.token}` },
      payload: mutation,
    });
    expect(retry.json().results).toEqual([{ clientId, status: "applied" }]);
    expect(await prisma.medicalRecord.count({ where: { id: recordId } })).toBe(1);
  });

  it("rejects a create for a patient outside the caller's family", async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const res = await app.inject({
      method: "POST",
      url: "/sync/push",
      headers: { authorization: `Bearer ${stranger.token}` },
      payload: {
        deviceId: "device-2",
        mutations: [
          {
            clientId: "mut-x",
            entity: "record",
            op: "create",
            data: {
              id: "22222222-2222-2222-2222-222222222222",
              patientId: patient.id,
              recordType: "NOTE",
              title: "Should not land",
              fileType: "image/png",
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    });

    expect(res.json().results).toEqual([{ clientId: "mut-x", status: "rejected" }]);
  });

  it("reports a stale update when the server's copy is newer", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const record = await uploadRecord(owner.token, patient.id);

    // Server-side edit bumps updatedAt to "now".
    await app.inject({
      method: "PATCH",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: "Edited on server" },
    });

    // An offline mutation timestamped before that edit should be rejected as stale.
    const staleUpdatedAt = new Date(Date.now() - 60_000).toISOString();
    const res = await app.inject({
      method: "POST",
      url: "/sync/push",
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        deviceId: "device-1",
        mutations: [
          {
            clientId: "mut-stale",
            entity: "record",
            op: "update",
            data: { id: record.id, title: "Edited offline" },
            updatedAt: staleUpdatedAt,
          },
        ],
      },
    });

    expect(res.json().results).toEqual([{ clientId: "mut-stale", status: "stale" }]);
    const current = await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(current.title).toBe("Edited on server");
  });

  it("applies a delete mutation", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const record = await uploadRecord(owner.token, patient.id);

    const res = await app.inject({
      method: "POST",
      url: "/sync/push",
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        deviceId: "device-1",
        mutations: [
          {
            clientId: "mut-del",
            entity: "record",
            op: "delete",
            data: { id: record.id },
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    });

    expect(res.json().results).toEqual([{ clientId: "mut-del", status: "applied" }]);
    const deleted = await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(deleted.deletedAt).not.toBeNull();
  });
});
