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

describe("POST /audit/sync", () => {
  it("applies mobile-originated audit entries tagged with the device", async () => {
    const { user, token } = await registerUser(app);

    const res = await app.inject({
      method: "POST",
      url: "/audit/sync",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        deviceId: "device-abc",
        entries: [
          {
            clientId: "entry-1",
            actorType: "DEVICE",
            eventType: "LOGIN",
            entityType: "user",
            entityId: user.id,
            occurredAt: new Date().toISOString(),
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().applied).toBe(1);

    const rows = await prisma.auditLog.findMany({ where: { clientId: "entry-1" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("MOBILE");
    expect(rows[0].deviceId).toBe("device-abc");
    expect(rows[0].userId).toBe(user.id);
  });

  it("is idempotent when the same batch is retried", async () => {
    const { token } = await registerUser(app);
    const payload = {
      deviceId: "device-abc",
      entries: [
        {
          clientId: "entry-dup",
          actorType: "DEVICE" as const,
          eventType: "UPLOAD" as const,
          occurredAt: new Date().toISOString(),
        },
      ],
    };

    await app.inject({
      method: "POST",
      url: "/audit/sync",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    const retry = await app.inject({
      method: "POST",
      url: "/audit/sync",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    expect(retry.statusCode).toBe(200);
    expect(await prisma.auditLog.count({ where: { clientId: "entry-dup" } })).toBe(1);
  });
});
