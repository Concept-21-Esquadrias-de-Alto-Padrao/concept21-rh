import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { validateDeploymentEnvironment } from "../src/lib/deployment-environment.mjs";
import { assertHomologationTarget, config, privateDir, root, runCli } from "./lib/homologation.mjs";

assertHomologationTarget();
const env = JSON.parse(readFileSync(path.join(privateDir, "app-env.json"), "utf8"));
validateDeploymentEnvironment({ environment: env.NEXT_PUBLIC_APP_ENV, supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL, expectedTestRef: env.NEXT_PUBLIC_HOMOLOGATION_SUPABASE_REF });
const teamId = "team_CQgXB4kvuQBOXiv4siUoGnUe";
const scope = ["--scope", config.vercelTeam];
const project = JSON.parse(runCli("vercel@50.28.0", ["api", `/v9/projects/${config.vercelProjectName}?teamId=${teamId}`, "--raw", ...scope]));
if (project.name !== config.vercelProjectName || project.id === "prj_FIuesZaxPSgLRkJ0Y1CNjIATMfsV" || project.accountId !== teamId) {
  throw new Error("O destino Vercel não é a homologação autorizada.");
}

runCli("vercel@50.28.0", ["api", `/v9/projects/${project.id}?teamId=${teamId}`, "--method", "PATCH", "--input", "-", "--silent", ...scope], {
  input: JSON.stringify({ framework: "nextjs", nodeVersion: "24.x" }),
});
for (const [key, value] of Object.entries(env)) {
  runCli("vercel@50.28.0", ["api", `/v10/projects/${project.id}/env?teamId=${teamId}&upsert=true`, "--method", "POST", "--input", "-", "--header", "Content-Type: application/json", "--silent", ...scope], {
    input: JSON.stringify({ key, value, type: key === "SUPABASE_SERVICE_ROLE_KEY" ? "sensitive" : "encrypted", target: ["production", "preview"] }),
  });
}

const deployDir = path.join(privateDir, "deploy");
mkdirSync(path.join(deployDir, ".vercel"), { recursive: true });
const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const rootFiles = new Set(["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs", ".vercelignore"]);
for (const file of files) {
  if (!(file.startsWith("src/") || file.startsWith("public/") || rootFiles.has(file))) continue;
  const target = path.join(deployDir, file);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(path.join(root, file), target);
}
writeFileSync(path.join(deployDir, ".vercel/project.json"), JSON.stringify({ orgId: teamId, projectId: project.id, projectName: project.name }));
const inspected = runCli("vercel@50.28.0", ["project", "inspect", "--non-interactive", ...scope], { cwd: deployDir });
if (inspected && !inspected.includes(project.name)) throw new Error("A verificação do projeto Vercel não confirmou o destino esperado.");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
console.log(`Publicando somente ${project.name}; origem ${commit.slice(0, 7)} com alterações de homologação.`);
const output = runCli("vercel@50.28.0", ["deploy", "--prod", "--yes", "--non-interactive", "--meta", `gitCommitSha=${commit}`, ...scope], { cwd: deployDir, timeout: 300_000 });
const url = output.trim().split(/\s+/).find((value) => /^https:\/\/[^/]+\.vercel\.app$/.test(value));
if (!url) throw new Error("O deploy não retornou uma URL verificável.");
writeFileSync(path.join(privateDir, "deployment.json"), JSON.stringify({ projectId: project.id, projectName: project.name, url, appUrl: config.appUrl, commit, createdAt: new Date().toISOString() }, null, 2));
console.log(`Homologação publicada: ${config.appUrl}\nDeployment: ${url}`);
