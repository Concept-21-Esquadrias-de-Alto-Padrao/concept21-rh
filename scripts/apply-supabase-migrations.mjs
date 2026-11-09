#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

export function runMigrations(argv, { query = queryRows, execute = runSupabaseDbQuery, log = console.log, cwd = process.cwd() } = {}) {
  const options = parseArgs(argv);
  const migrationsPath = path.resolve(cwd, options.migrationsPath);

  if (options.baselineExisting) {
    throw new Error(
      "Automatic baseline is disabled: it can mark unapplied migrations as applied. " +
      "Reconcile the existing database and checksums first; see supabase/README.md.",
    );
  }

  if (!existsSync(migrationsPath)) {
    throw new Error(`Migrations path not found: ${options.migrationsPath}`);
  }

  const migrations = getMigrationFiles(migrationsPath);

  if (migrations.length === 0) {
    log("No migration files found.");
    return;
  }

  const historyExistsRows = query("select to_regclass('app.codex_migration_history') is not null as exists;");
  if (typeof historyExistsRows[0]?.exists !== "boolean") {
    throw new Error("Could not verify migration history; no changes were made.");
  }
  const historyExists = historyExistsRows[0].exists;
  const history = historyExists
    ? query("select version, file_name, checksum_sha256 from app.codex_migration_history order by version;")
    : [];

  if (history.length === 0) {
    const existingSchemaRows = query(`
select exists (
  select 1 from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'app')
    and c.relkind in ('r', 'p')
    and not (n.nspname = 'app' and c.relname = 'codex_migration_history')
) as exists;
`);
    if (typeof existingSchemaRows[0]?.exists !== "boolean") {
      throw new Error("Could not verify whether the database is empty; no changes were made.");
    }
    if (existingSchemaRows[0].exists) {
      throw new Error(
        "Existing database has no reconciled app.codex_migration_history. " +
        "Refusing to replay migrations or create a baseline. See supabase/README.md.",
      );
    }
  }

  const filesByVersion = new Map(migrations.map((migration) => [migration.version, migration]));
  for (const row of history) {
    const migration = filesByVersion.get(row.version);
    if (!migration) {
      throw new Error(`Recorded migration is missing from this checkout: ${row.version}. No changes were made.`);
    }
    if (row.file_name !== migration.name || row.checksum_sha256 !== sha256(migration.fullPath)) {
      throw new Error(`Migration checksum or filename mismatch: ${migration.name}. No changes were made.`);
    }
  }

  const applied = new Set(history.map((row) => row.version));
  const pending = migrations.filter((migration) => !applied.has(migration.version));

  if (pending.length === 0) {
    log("No pending migrations.");
    return;
  }

  if (!options.dryRun) {
    execute({ sql: historySql });
  }

  for (const migration of pending) {
    const checksum = sha256(migration.fullPath);

    log(`Pending migration: ${migration.name} [applied]`);

    if (options.dryRun) {
      continue;
    }

    execute({ file: migration.fullPath });

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
  'applied',
  'codex'
);
`;

    execute({ sql: recordSql });
  }

  log("Migration sync complete.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runMigrations(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
