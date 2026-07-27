import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";
import { resetDb } from "../test-utils.js";

const app = buildApp();

beforeEach(resetDb);

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("POST /auth/register", () => {
  it("creates a user and returns a token (AC1)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Asha", email: "asha@example.com", password: "password123" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe("asha@example.com");
    expect(typeof body.token).toBe("string");
  });

  it("rejects a duplicate email with 409 (AC2)", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Asha", email: "asha@example.com", password: "password123" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Someone Else", email: "asha@example.com", password: "anotherpass" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("rejects invalid input with 400 and does not hit the database (AC5)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "", email: "not-an-email", password: "short" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("VALIDATION_ERROR");
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("POST /auth/login", () => {
  it("returns a token for correct credentials (AC3)", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Asha", email: "asha@example.com", password: "password123" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "asha@example.com", password: "password123" },
    });

    expect(res.statusCode).toBe(200);
    expect(typeof res.json().token).toBe("string");
  });

  it("rejects incorrect password with 401 (AC4)", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Asha", email: "asha@example.com", password: "password123" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "asha@example.com", password: "wrong-password" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("INVALID_CREDENTIALS");
  });

  it("rejects unknown email with 401 (AC4)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nobody@example.com", password: "password123" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("INVALID_CREDENTIALS");
  });
});
