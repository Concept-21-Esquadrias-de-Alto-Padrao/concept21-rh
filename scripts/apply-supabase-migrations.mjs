#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DEFAULT_MIGRATIONS_PATH = "supabase/migrations";

function parseArgs(argv) {
  const options = {
    baselineExisting: false,
    dryRun: false,
    migrationsPath: DEFAULT_MIGRATIONS_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--baseline-existing") {
      options.baselineExisting = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--migrations-path") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--migrations-path requires a value.");
      }
      options.migrationsPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--migrations-path=")) {
      options.migrationsPath = arg.slice("--migrations-path=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getNpxInvocation(args) {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", "npx", ...args],
    };
  }

  return {
    command: "npx",
    args,
  };
}

function formatCommand(args) {
  const invocation = getNpxInvocation(args);
  return `${invocation.command} ${invocation.args.join(" ")}`;
}

function createTempSqlFile(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), "codex-supabase-sql-"));
  const file = path.join(dir, `${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");

  return { dir, file };
}

function runSupabaseDbQuery({ sql, file, json = false }) {
  const temp = file ? null : createTempSqlFile(sql);
  const sqlFile = file ?? temp.file;
  const args = ["--yes", "supabase", "db", "query", "--linked", "--file", sqlFile];

  if (json) {
    args.push("--output-format", "json");
  }

  try {
    const invocation = getNpxInvocation(args);
    const result = spawnSync(invocation.command, invocation.args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: json ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const stderr = result.stderr?.trim();
      const stdout = result.stdout?.trim();
      const details = [stderr, stdout].filter(Boolean).join("\n");
      throw new Error(
        `Supabase SQL command failed (${formatCommand(args)}).${details ? `\n${details}` : ""}`,
      );
    }

    return json ? result.stdout : "";
  } finally {
    if (temp) {
      rmSync(temp.dir, { force: true, recursive: true });
    }
  }
}

function extractJson(text) {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Supabase CLI returned empty JSON output.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    const starts = [objectStart, arrayStart].filter((value) => value >= 0);

    if (starts.length === 0) {
      throw new Error(`Could not parse Supabase JSON output:\n${trimmed}`);
    }

    const start = Math.min(...starts);
    const end = start === arrayStart && arrayEnd >= 0 ? arrayEnd : objectEnd;

    if (end <= start) {
      throw new Error(`Could not parse Supabase JSON output:\n${trimmed}`);
    }

    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function rowsFromJsonOutput(output) {
  const parsed = extractJson(output);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.rows)) {
    return parsed.rows;
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }

  throw new Error(`Unexpected Supabase JSON shape: ${JSON.stringify(parsed)}`);
}

function queryRows(sql) {
  return rowsFromJsonOutput(runSupabaseDbQuery({ sql, json: true }));
}

function sqlLiteral(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function getMigrationFiles(migrationsPath) {
  return readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => ({
      fullPath: path.join(migrationsPath, entry.name),
      name: entry.name,
      version: path.basename(entry.name, ".sql"),
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

const historySql = `
create schema if not exists app;

create table if not exists app.codex_migration_history (
  version text primary key,
  file_name text not null,
  checksum_sha256 text not null,
  execution_mode text not null check (execution_mode in ('baseline', 'applied')),
  applied_at timestamptz not null default now(),
  applied_by text not null default 'codex'
);
`;

function main() {
  const options = parseArgs(process.argv.slice(2));
  const migrationsPath = path.resolve(process.cwd(), options.migrationsPath);

  if (!existsSync(migrationsPath)) {
    throw new Error(`Migrations path not found: ${options.migrationsPath}`);
  }

  if (!options.dryRun) {
    runSupabaseDbQuery({ sql: historySql });
  }

  const migrations = getMigrationFiles(migrationsPath);

  if (migrations.length === 0) {
    console.log("No migration files found.");
    return;
  }

  const historyExistsRows = queryRows("select to_regclass('app.codex_migration_history') is not null as exists;");
  const historyExists = Boolean(historyExistsRows[0]?.exists);
  const applied = new Set();

  if (historyExists) {
    for (const row of queryRows("select version from app.codex_migration_history order by version;")) {
      applied.add(row.version);
    }
  }

  const pending = migrations.filter((migration) => !applied.has(migration.version));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  for (const migration of pending) {
    const checksum = sha256(migration.fullPath);
    const mode = options.baselineExisting ? "baseline" : "applied";

    console.log(`Pending migration: ${migration.name} [${mode}]`);

    if (options.dryRun) {
      continue;
    }

    if (!options.baselineExisting) {
      runSupabaseDbQuery({ file: migration.fullPath });
    }

    const recordSql = `
insert into app.codex_migration_history (
  version,
  file_name,
  checksum_sha256,
  execution_mode,
  applied_by
) values (
  ${sqlLiteral(migration.version)},
  ${sqlLiteral(migration.name)},
  ${sqlLiteral(checksum)},
  ${sqlLiteral(mode)},
  'codex'
)
on conflict (version) do update
set
  file_name = excluded.file_name,
  checksum_sha256 = excluded.checksum_sha256,
  execution_mode = excluded.execution_mode,
  applied_by = excluded.applied_by;
`;

    runSupabaseDbQuery({ sql: recordSql });
  }

  console.log("Migration sync complete.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
