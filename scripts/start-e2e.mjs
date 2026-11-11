import { cpSync } from "node:fs";
import { spawn } from "node:child_process";
import "./check-release-artifact.mjs";

// Match the deployment package: test the standalone runtime with only its
// assets and game configuration, without relying on application source files.
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync("config", ".next/standalone/config", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit", windowsHide: true,
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("error", (error) => { console.error(error); process.exit(1); });
server.on("exit", (code) => process.exit(code ?? 1));
