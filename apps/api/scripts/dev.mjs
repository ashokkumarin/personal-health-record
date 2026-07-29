import net from "node:net";
import { spawn } from "node:child_process";

// Windows + Docker Desktop can end up with both a host process and the docker
// "api" container simultaneously LISTENING on the same port (observed directly
// via `netstat` on this project — normally impossible, but happens here via
// however WSL2/WinNAT share the port). That means a plain "try to bind it
// myself" EADDRINUSE check isn't reliable: binding can succeed even when
// something else already owns the port. Instead, actively try to *connect* —
// if anything answers, refuse to start rather than silently split-braining
// with whichever process happens to answer a given request.
function isPortTaken(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

const port = Number(process.env.API_PORT ?? 4000);

if (await isPortTaken(port)) {
  console.error(`\n✖ Port ${port} is already in use — refusing to start the dev server.\n`);
  console.error(
    `This is usually the Docker "api" container already running on this port. Running\n` +
      `both at once causes requests to randomly hit whichever process answers, each with\n` +
      `its own separate file storage — a confusing split-brain bug that has bitten this\n` +
      `project before.\n\n` +
      `Fix: stop the Docker api container first (docker compose stop api), or set a\n` +
      `different API_PORT in .env for one of the two.\n`
  );
  process.exit(1);
}

const child = spawn("npx", ["tsx", "watch", "src/server.ts"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 0));
