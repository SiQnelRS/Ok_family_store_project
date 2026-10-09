import "dotenv/config";
import { spawnSync } from "node:child_process";
import concurrently from "concurrently";

function run(script, workspace) {
  const args = ["run", script, ...(workspace ? ["-w", workspace] : [])];
  // npm_execpath evita diferencias entre npm.cmd de Windows y npm de Linux.
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("db:generate");
for (const name of ["shared", "database", "service-kit", "api-gateway", "auth-service", "catalog-service", "commerce-service"]) {
  run("build", "@ok-family/" + name);
}

const services = ["api-gateway", "auth-service", "catalog-service", "commerce-service"];
const { result } = concurrently(
  [
    { command: "npm run dev -w @ok-family/frontend", name: "web", prefixColor: "green" },
    ...services.map((service) => ({ command: "npm run dev -w @ok-family/" + service, name: service, prefixColor: "cyan" })),
    ...["shared", "database", "service-kit", ...services].map((name) => ({
      command: "tsc -p " + (services.includes(name) ? "apps/" : "packages/") + name + "/tsconfig.json --watch --preserveWatchOutput",
      name: "ts:" + name,
      prefixColor: "gray",
    })),
  ],
  { killOthersOn: ["failure", "success"], prefix: "name" },
);

try {
  await result;
} catch {
  process.exitCode = 1;
}
