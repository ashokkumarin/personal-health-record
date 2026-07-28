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

describe("GET /users/me", () => {
  it("returns the authenticated user's own profile", async () => {
    const { token, user } = await registerUser(app, { name: "Asha", email: "asha.me@example.com" });

    const res = await app.inject({
      method: "GET",
      url: "/users/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(user.id);
    expect(res.json().email).toBe("asha.me@example.com");
  });
});

describe("PATCH /users/me", () => {
  it("updates name, email, and phone", async () => {
    const { token } = await registerUser(app);

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "New Name", email: "updated@example.com", phone: "+91 98765 43210" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("New Name");
    expect(res.json().email).toBe("updated@example.com");
    expect(res.json().phone).toBe("+91 98765 43210");
  });

  it("a partial update (phone only) leaves name and email unchanged", async () => {
    const { token, user } = await registerUser(app);

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { phone: "+91 90000 00000" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe(user.name);
    expect(res.json().email).toBe(user.email);
    expect(res.json().phone).toBe("+91 90000 00000");
  });

  it("rejects a duplicate email with 409", async () => {
    await registerUser(app, { email: "taken@example.com" });
    const { token } = await registerUser(app);

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { email: "taken@example.com" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("EMAIL_ALREADY_REGISTERED");
  });
});

describe("POST /users/me/password", () => {
  it("changes the password when the current password is correct", async () => {
    const email = "changepw@example.com";
    const { token } = await registerUser(app, { email, password: "oldpassword123" });

    const res = await app.inject({
      method: "POST",
      url: "/users/me/password",
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: "oldpassword123", newPassword: "newpassword456" },
    });

    expect(res.statusCode).toBe(200);

    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "newpassword456" },
    });
    expect(loginRes.statusCode).toBe(200);
  });

  it("rejects an incorrect current password with 401", async () => {
    const { token } = await registerUser(app, { password: "oldpassword123" });

    const res = await app.inject({
      method: "POST",
      url: "/users/me/password",
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: "wrongpassword", newPassword: "newpassword456" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("INVALID_CREDENTIALS");
  });
});

describe("POST /users/me/photo", () => {
  it("uploads a photo and returns a signed avatarUrl", async () => {
    const { token } = await registerUser(app);

    const form = new FormData();
    form.append("file", TINY_PNG, { filename: "avatar.png", contentType: "image/png" });

    const res = await app.inject({
      method: "POST",
      url: "/users/me/photo",
      headers: { authorization: `Bearer ${token}`, ...form.getHeaders() },
      payload: form.getBuffer(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().avatarUrl).toBeTruthy();
  });

  it("rejects an unsupported file type with 400", async () => {
    const { token } = await registerUser(app);

    const form = new FormData();
    form.append("file", Buffer.from("not a photo"), {
      filename: "note.txt",
      contentType: "text/plain",
    });

    const res = await app.inject({
      method: "POST",
      url: "/users/me/photo",
      headers: { authorization: `Bearer ${token}`, ...form.getHeaders() },
      payload: form.getBuffer(),
    });

    expect(res.statusCode).toBe(400);
  });
});
