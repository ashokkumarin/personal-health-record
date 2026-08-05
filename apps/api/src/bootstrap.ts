import { prisma } from "./db.js";
import { hashPassword } from "./auth-utils.js";

// Idempotent — safe to call on every server startup. Not called from
// buildApp() so it never touches the test database (tests call buildApp()
// directly and manage their own users via resetDb()/registerUser()).
export async function ensureAdminUser(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "WARNING: ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin account bootstrap. " +
        "No one will be able to access the admin panel until you set these and restart."
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    await prisma.user.create({
      data: { name: "Admin", email, passwordHash, isAdmin: true },
    });
    console.log(`Bootstrapped admin account: ${email}`);
    return;
  }

  // Re-assert isAdmin/deletedAt on every startup so editing ADMIN_EMAIL in
  // .env always lands on a working admin account, but never overwrite a
  // password the admin has since changed themselves.
  if (!existing.isAdmin || existing.deletedAt) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { isAdmin: true, deletedAt: null },
    });
  }
}
