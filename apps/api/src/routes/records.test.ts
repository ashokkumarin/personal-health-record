import { beforeEach, beforeAll, afterAll, describe, expect, it } from "vitest";
import FormData from "form-data";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";
import { registerUser, resetDb } from "../test-utils.js";
import { ensureBucket } from "../storage.js";

const app = buildApp();

// A real 1x1 PNG so tesseract.js can actually decode it instead of crashing
// on garbage bytes (it emits an uncaught worker-level error on unreadable images).
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

beforeAll(async () => {
  await ensureBucket();
});

beforeEach(resetDb);

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function buildMultipart(
  fields: Record<string, string>,
  file?: { buffer: Buffer; filename: string; contentType: string }
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  if (file) {
    form.append("file", file.buffer, { filename: file.filename, contentType: file.contentType });
  }
  const payload = form.getBuffer();
  const headers = form.getHeaders();
  return { payload, headers };
}

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

describe("POST /patients/:patientId/records", () => {
  it("family member can upload a supported file (AC1)", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const { payload, headers } = await buildMultipart(
      { recordType: "PRESCRIPTION", title: "Dr Rao prescription" },
      { buffer: TINY_PNG, filename: "rx.jpg", contentType: "image/jpeg" }
    );

    const res = await app.inject({
      method: "POST",
      url: `/patients/${patient.id}/records`,
      headers: { authorization: `Bearer ${owner.token}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const record = res.json();
    expect(record.title).toBe("Dr Rao prescription");
    expect(record.patientId).toBe(patient.id);
    expect(record.fileType).toBe("image/jpeg");
  });

  it("unsupported file type is rejected with 400 (AC2)", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const { payload, headers } = await buildMultipart(
      { recordType: "NOTE", title: "A note" },
      { buffer: Buffer.from("hello"), filename: "note.txt", contentType: "text/plain" }
    );

    const res = await app.inject({
      method: "POST",
      url: `/patients/${patient.id}/records`,
      headers: { authorization: `Bearer ${owner.token}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(400);
  });

  it("non-member of the patient's family gets 403 (AC3)", async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const { payload, headers } = await buildMultipart(
      { recordType: "NOTE", title: "A note" },
      { buffer: Buffer.from("hi"), filename: "note.pdf", contentType: "application/pdf" }
    );

    const res = await app.inject({
      method: "POST",
      url: `/patients/${patient.id}/records`,
      headers: { authorization: `Bearer ${stranger.token}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(403);
  });

  it("unauthenticated request gets 401 (AC4)", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const { payload, headers } = await buildMultipart(
      { recordType: "NOTE", title: "A note" },
      { buffer: Buffer.from("hi"), filename: "note.pdf", contentType: "application/pdf" }
    );

    const res = await app.inject({
      method: "POST",
      url: `/patients/${patient.id}/records`,
      headers,
      payload,
    });

    expect(res.statusCode).toBe(401);
  });
});

async function uploadRecord(
  token: string,
  patientId: string,
  fields: Record<string, string>,
  contentType = "image/jpeg"
) {
  const { payload, headers } = await buildMultipart(fields, {
    buffer: TINY_PNG,
    filename: "f.jpg",
    contentType,
  });
  const res = await app.inject({
    method: "POST",
    url: `/patients/${patientId}/records`,
    headers: { authorization: `Bearer ${token}`, ...headers },
    payload,
  });
  return res.json();
}

describe("GET /families/:familyId/records (timeline & search)", () => {
  it("returns records in descending chronological order (AC1)", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);

    await uploadRecord(owner.token, patient.id, {
      recordType: "PRESCRIPTION",
      title: "Older",
      capturedAt: "2024-01-01",
    });
    await uploadRecord(owner.token, patient.id, {
      recordType: "PRESCRIPTION",
      title: "Newer",
      capturedAt: "2024-06-01",
    });

    const res = await app.inject({
      method: "GET",
      url: `/families/${family.id}/records`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(res.statusCode).toBe(200);
    const titles = res.json().map((r: { title: string }) => r.title);
    expect(titles).toEqual(["Newer", "Older"]);
  });

  it("patientId filter narrows results (AC2)", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);
    const otherPatientRes = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { mode: "no_account", name: "Sibling Gupta" },
    });
    const otherPatient = otherPatientRes.json();

    await uploadRecord(owner.token, patient.id, { recordType: "NOTE", title: "For Baby" });
    await uploadRecord(owner.token, otherPatient.id, { recordType: "NOTE", title: "For Sibling" });

    const res = await app.inject({
      method: "GET",
      url: `/families/${family.id}/records?patientId=${patient.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const titles = res.json().map((r: { title: string }) => r.title);
    expect(titles).toEqual(["For Baby"]);
  });

  it("recordType filter narrows results (AC3)", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);

    await uploadRecord(owner.token, patient.id, { recordType: "PRESCRIPTION", title: "Rx" });
    await uploadRecord(owner.token, patient.id, { recordType: "LAB_REPORT", title: "Lab" });

    const res = await app.inject({
      method: "GET",
      url: `/families/${family.id}/records?recordType=LAB_REPORT`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const titles = res.json().map((r: { title: string }) => r.title);
    expect(titles).toEqual(["Lab"]);
  });

  it("date range filter narrows results (AC4)", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);

    await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "January",
      capturedAt: "2024-01-15",
    });
    await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "July",
      capturedAt: "2024-07-15",
    });

    const res = await app.inject({
      method: "GET",
      url: `/families/${family.id}/records?dateFrom=2024-06-01&dateTo=2024-12-31`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const titles = res.json().map((r: { title: string }) => r.title);
    expect(titles).toEqual(["July"]);
  });

  it("keyword search matches title (AC5)", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);

    await uploadRecord(owner.token, patient.id, { recordType: "NOTE", title: "Fever checkup" });
    await uploadRecord(owner.token, patient.id, { recordType: "NOTE", title: "Dental visit" });

    const res = await app.inject({
      method: "GET",
      url: `/families/${family.id}/records?q=fever`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    const titles = res.json().map((r: { title: string }) => r.title);
    expect(titles).toEqual(["Fever checkup"]);
  });

  it("non-member of the family gets 403 (AC6)", async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const { family } = await setupFamilyWithPatient(owner.token);

    const res = await app.inject({
      method: "GET",
      url: `/families/${family.id}/records`,
      headers: { authorization: `Bearer ${stranger.token}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("visibility rules", () => {
  it("unlinked patient's records are visible to owner/admin by default (AC1)", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);
    await uploadRecord(owner.token, patient.id, { recordType: "NOTE", title: "Visible note" });

    const res = await app.inject({
      method: "GET",
      url: `/families/${family.id}/records`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(res.json()).toHaveLength(1);
  });

  it("linked patient's records are hidden from other members by default (AC2)", async () => {
    const owner = await registerUser(app);
    const linkedUser = await registerUser(app);
    const family = (
      await app.inject({
        method: "POST",
        url: "/families",
        headers: { authorization: `Bearer ${owner.token}` },
        payload: { name: "The Vermas" },
      })
    ).json();

    const patientRes = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        mode: "link_existing",
        name: "Verma Senior",
        existingUserEmail: linkedUser.user.email,
      },
    });
    const patient = patientRes.json();

    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { patientId: patient.id },
    });
    await app.inject({
      method: "POST",
      url: `/approval-requests/${approval.id}/approve`,
      headers: { authorization: `Bearer ${linkedUser.token}` },
    });

    await uploadRecord(owner.token, patient.id, { recordType: "NOTE", title: "Private note" });

    const ownerView = await app.inject({
      method: "GET",
      url: `/families/${family.id}/records`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(ownerView.json()).toHaveLength(0);

    const linkedUserView = await app.inject({
      method: "GET",
      url: `/families/${family.id}/records`,
      headers: { authorization: `Bearer ${linkedUser.token}` },
    });
    expect(linkedUserView.json()).toHaveLength(1);

    return { family, patient, linkedUser, owner };
  });

  it("after opting in, other members can see the records (AC3)", async () => {
    const owner = await registerUser(app);
    const linkedUser = await registerUser(app);
    const family = (
      await app.inject({
        method: "POST",
        url: "/families",
        headers: { authorization: `Bearer ${owner.token}` },
        payload: { name: "The Vermas" },
      })
    ).json();

    const patientRes = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        mode: "link_existing",
        name: "Verma Senior",
        existingUserEmail: linkedUser.user.email,
      },
    });
    const patient = patientRes.json();

    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { patientId: patient.id },
    });
    await app.inject({
      method: "POST",
      url: `/approval-requests/${approval.id}/approve`,
      headers: { authorization: `Bearer ${linkedUser.token}` },
    });

    await uploadRecord(owner.token, patient.id, { recordType: "NOTE", title: "Shared note" });

    await app.inject({
      method: "PATCH",
      url: `/patients/${patient.id}/visibility`,
      headers: { authorization: `Bearer ${linkedUser.token}` },
      payload: { visibleToFamily: true },
    });

    const ownerView = await app.inject({
      method: "GET",
      url: `/families/${family.id}/records`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(ownerView.json()).toHaveLength(1);
  });

  it("non-linked-user gets 403 changing visibility (AC4)", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const res = await app.inject({
      method: "PATCH",
      url: `/patients/${patient.id}/visibility`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { visibleToFamily: true },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /me/timeline", () => {
  it("returns no patient and an empty list for a user with no linked patient profile", async () => {
    const { token } = await registerUser(app);

    const res = await app.inject({
      method: "GET",
      url: "/me/timeline",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ patient: null, records: [] });
  });

  it("returns the caller's own patient and records in descending order", async () => {
    const owner = await registerUser(app);
    const linkedUser = await registerUser(app);
    const family = (
      await app.inject({
        method: "POST",
        url: "/families",
        headers: { authorization: `Bearer ${owner.token}` },
        payload: { name: "The Menons" },
      })
    ).json();

    const patientRes = await app.inject({
      method: "POST",
      url: `/families/${family.id}/members`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        mode: "link_existing",
        name: "Menon Senior",
        existingUserEmail: linkedUser.user.email,
      },
    });
    const patient = patientRes.json();

    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { patientId: patient.id },
    });
    await app.inject({
      method: "POST",
      url: `/approval-requests/${approval.id}/approve`,
      headers: { authorization: `Bearer ${linkedUser.token}` },
    });

    await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "Older",
      capturedAt: "2024-01-01",
    });
    await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "Newer",
      capturedAt: "2024-06-01",
    });

    const res = await app.inject({
      method: "GET",
      url: "/me/timeline",
      headers: { authorization: `Bearer ${linkedUser.token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().patient.id).toBe(patient.id);
    expect(res.json().records.map((r: { title: string }) => r.title)).toEqual([
      "Newer",
      "Older",
    ]);
  });
});

describe("thumbnail generation", () => {
  it("a supported image upload produces a record with a thumbnailUrl", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);

    const record = await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "Has a thumbnail",
    });

    const res = await app.inject({
      method: "GET",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().thumbnailUrl).toBeTruthy();
  });
});

async function addUnrelatedActiveMember(ownerToken: string, familyId: string) {
  const stranger = await registerUser(app);
  const memberRes = await app.inject({
    method: "POST",
    url: `/families/${familyId}/members`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { mode: "link_existing", name: "Unrelated Member", existingUserEmail: stranger.user.email },
  });
  const patient = memberRes.json();
  const approval = await prisma.approvalRequest.findFirstOrThrow({ where: { patientId: patient.id } });
  await app.inject({
    method: "POST",
    url: `/approval-requests/${approval.id}/approve`,
    headers: { authorization: `Bearer ${stranger.token}` },
  });
  return stranger;
}

describe("DELETE /records/:id", () => {
  it("the uploader can delete their own record", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);
    const record = await uploadRecord(owner.token, patient.id, { recordType: "NOTE", title: "Mine" });

    const res = await app.inject({
      method: "DELETE",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(res.statusCode).toBe(204);
    expect(await prisma.medicalRecord.findUnique({ where: { id: record.id } })).toBeNull();
  });

  it("family owner/admin can delete someone else's upload", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);
    const uploader = await addUnrelatedActiveMember(owner.token, family.id);
    const record = await uploadRecord(uploader.token, patient.id, {
      recordType: "NOTE",
      title: "Uploaded by member",
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(res.statusCode).toBe(204);
  });

  it("the record's own linked patient can delete it even if someone else uploaded it", async () => {
    const owner = await registerUser(app);
    const { family } = await setupFamilyWithPatient(owner.token);
    const linkedUser = await addUnrelatedActiveMember(owner.token, family.id);
    const patient = await prisma.patientProfile.findFirstOrThrow({
      where: { linkedUserId: linkedUser.user.id },
    });
    const record = await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "About the linked patient",
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${linkedUser.token}` },
    });

    expect(res.statusCode).toBe(204);
  });

  it("an unrelated active family member gets 403", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);
    const stranger = await addUnrelatedActiveMember(owner.token, family.id);
    const record = await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "Not theirs",
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${stranger.token}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /records/:id", () => {
  it("updates title, record type, and captured date", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);
    const record = await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "Original title",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: "Updated title", recordType: "LAB_REPORT", capturedAt: "2024-02-02" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Updated title");
    expect(res.json().recordType).toBe("LAB_REPORT");
    expect(res.json().capturedAt).toContain("2024-02-02");
  });

  it("an unrelated active family member gets 403", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);
    const stranger = await addUnrelatedActiveMember(owner.token, family.id);
    const record = await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "Not theirs",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/records/${record.id}`,
      headers: { authorization: `Bearer ${stranger.token}` },
      payload: { title: "Hijacked" },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("PUT /records/:id/file", () => {
  it("replaces the file and regenerates the thumbnail", async () => {
    const owner = await registerUser(app);
    const { patient } = await setupFamilyWithPatient(owner.token);
    const record = await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "Will be replaced",
    });
    const originalFilePath = record.filePath;

    const { payload, headers } = await buildMultipart(
      {},
      { buffer: TINY_PNG, filename: "replacement.png", contentType: "image/png" }
    );

    const res = await app.inject({
      method: "PUT",
      url: `/records/${record.id}/file`,
      headers: { authorization: `Bearer ${owner.token}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().filePath).not.toBe(originalFilePath);
    expect(res.json().thumbnailUrl).toBeTruthy();
  });

  it("an unrelated active family member gets 403", async () => {
    const owner = await registerUser(app);
    const { family, patient } = await setupFamilyWithPatient(owner.token);
    const stranger = await addUnrelatedActiveMember(owner.token, family.id);
    const record = await uploadRecord(owner.token, patient.id, {
      recordType: "NOTE",
      title: "Not theirs",
    });

    const { payload, headers } = await buildMultipart(
      {},
      { buffer: TINY_PNG, filename: "replacement.png", contentType: "image/png" }
    );

    const res = await app.inject({
      method: "PUT",
      url: `/records/${record.id}/file`,
      headers: { authorization: `Bearer ${stranger.token}`, ...headers },
      payload,
    });

    expect(res.statusCode).toBe(403);
  });
});
