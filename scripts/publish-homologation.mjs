import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config, privateDir, root, runCli } from "./lib/homologation.mjs";
import { projectId, teamId, vercelApi, verifyPublishedEnvironment } from "./lib/homologation-handoff.mjs";

try {
  const action = process.argv[2] ?? "inspect";
  if (!["inspect", "stage", "promote", "rollback"].includes(action)) throw new Error("Use inspect, stage, promote ID ou rollback ID.");
  const { project } = verifyPublishedEnvironment();
  console.log(JSON.stringify({ project: project.name, projectId, teamId, current: project.targets?.production?.id, url: config.appUrl }));
  if (action !== "inspect") {
    mkdirSync(privateDir, { recursive: true });
    const dir = mkdtempSync(path.join(privateDir, "release-"));
    mkdirSync(path.join(dir, ".vercel"));
    writeFileSync(path.join(dir, ".vercel/project.json"), JSON.stringify({ orgId: teamId, projectId, projectName: config.vercelProjectName }));
    const scope = ["--scope", config.vercelTeam];
    if (action === "stage") {
      const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: root, encoding: "utf8" }).trim();
      if (dirty) throw new Error("Faça commit das alterações antes de preparar um deployment reproduzível.");
      const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
      const files = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD"], { cwd: root, encoding: "utf8" }).trim().split("\n");
      const roots = new Set(["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs", ".vercelignore"]);
      for (const file of files.filter((name) => name.startsWith("src/") || name.startsWith("public/") || roots.has(name))) {
        const target = path.join(dir, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, execFileSync("git", ["show", `${commit}:${file}`], { cwd: root, maxBuffer: 20 * 1024 * 1024 }));
      }
      console.log(runCli("vercel@50.28.0", ["deploy", "--prod", "--skip-domain", "--yes", "--non-interactive", "--meta", `gitCommitSha=${commit}`, ...scope], { cwd: dir, timeout: 300_000 }));
      console.log("Build preparado sem trocar o domínio. Teste a URL retornada antes de promover.");
    } else {
      const id = process.argv[3];
      if (!/^dpl_[A-Za-z0-9]+$/.test(id ?? "")) throw new Error("Informe um ID dpl_ verificado do projeto de homologação.");
      const deployment = vercelApi(`/v13/deployments/${id}`);
      if (deployment.projectId !== projectId || deployment.readyState !== "READY" || deployment.target !== "production") throw new Error("Deployment recusado: precisa estar READY e pertencer à homologação, preparado com --prod.");
      console.log(runCli("vercel@50.28.0", [action, id, "--yes", ...scope], { cwd: dir, timeout: 300_000 }));
    }
  }
} catch {
  console.error("Operação interrompida. Confira login Vercel, destino e estado do Git conforme docs/entrega-homologacao-rh.md. Nenhum detalhe de variáveis foi exibido.");
  process.exitCode = 1;
}
