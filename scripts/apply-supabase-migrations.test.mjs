import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runMigrations } from "./apply-supabase-migrations.mjs";

function fixture(t, { historyExists = false, populated = false, history = [], queryOverride, failFile = false } = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), "rh-migration-guard-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const migrationsPath = path.join(cwd, "supabase", "migrations");
  mkdirSync(migrationsPath, { recursive: true });
  const contents = "select 1;\n";
  writeFileSync(path.join(migrationsPath, "001_core.sql"), contents);
  const writes = [];
  const logs = [];
  const queries = [];
  const commands = {
    cwd,
    log: (value) => logs.push(value),
    query: (sql) => {
      queries.push(sql);
      if (queryOverride) return queryOverride(sql);
      if (sql.includes("to_regclass")) return [{ exists: historyExists }];
      if (sql.includes("select version, file_name")) return history;
      if (sql.includes("pg_class")) return [{ exists: populated }];
      throw new Error("Unexpected test query");
    },
    execute: (command) => {
      writes.push(command);
      if (failFile && command.file) throw new Error("Simulated migration failure");
    },
  };
  const recorded = {
    version: "001_core",
    file_name: "001_core.sql",
    checksum_sha256: createHash("sha256").update(contents).digest("hex"),
  };
  return { commands, writes, logs, queries, recorded };
}

for (const historyExists of [false, true]) {
  for (const argv of [[], ["--dry-run"]]) {
    test(`populated database with ${historyExists ? "empty" : "missing"} history refuses ${argv.length ? "dry run" : "push"} before writes`, (t) => {
      const f = fixture(t, { historyExists, populated: true });
      assert.throws(() => runMigrations(argv, f.commands), /Existing database has no reconciled/);
      assert.deepEqual(f.writes, []);
    });
  }
}

test("automatic baseline is rejected before querying or writing", (t) => {
  const f = fixture(t);
  assert.throws(() => runMigrations(["--baseline-existing"], f.commands), /Automatic baseline is disabled/);
  assert.deepEqual(f.queries, []);
  assert.deepEqual(f.writes, []);
});

test("changed applied SQL stops a pending migration before any write", (t) => {
  const history = [];
  const f = fixture(t, { historyExists: true, history });
  history.push({ ...f.recorded, checksum_sha256: "changed-checksum" });
  writeFileSync(path.join(f.commands.cwd, "supabase", "migrations", "002_pending.sql"), "select 2;\n");
  assert.throws(() => runMigrations([], f.commands), /checksum or filename mismatch/);
  assert.deepEqual(f.writes, []);
});

test("recorded filename mismatch stops before any write", (t) => {
  const history = [];
  const f = fixture(t, { historyExists: true, history });
  history.push({ ...f.recorded, file_name: "other.sql" });
  assert.throws(() => runMigrations([], f.commands), /checksum or filename mismatch/);
  assert.deepEqual(f.writes, []);
});

test("recorded migration missing from the checkout stops before any write", (t) => {
  const f = fixture(t, { historyExists: true, history: [{ version: "missing_version" }] });
  assert.throws(() => runMigrations([], f.commands), /missing from this checkout/);
  assert.deepEqual(f.writes, []);
});

test("unverifiable database state fails closed", (t) => {
  const f = fixture(t, { queryOverride: () => [{ exists: "false" }] });
  assert.throws(() => runMigrations([], f.commands), /Could not verify migration history/);
  assert.deepEqual(f.writes, []);
});

test("unverifiable empty-schema state fails closed", (t) => {
  const f = fixture(t, { queryOverride: (sql) => sql.includes("to_regclass") ? [{ exists: false }] : [] });
  assert.throws(() => runMigrations([], f.commands), /Could not verify whether the database is empty/);
  assert.deepEqual(f.writes, []);
});

test("empty database dry run lists migrations without creating history", (t) => {
  const f = fixture(t);
  runMigrations(["--dry-run"], f.commands);
  assert.ok(f.logs.some((line) => line.includes("001_core.sql")));
  assert.deepEqual(f.writes, []);
});

test("empty database can initialize history and apply its first migration", (t) => {
  const f = fixture(t);
  runMigrations([], f.commands);
  assert.equal(f.writes.length, 3);
  assert.match(f.writes[0].sql, /create table if not exists app.codex_migration_history/);
  assert.equal(path.basename(f.writes[1].file), "001_core.sql");
  assert.match(f.writes[2].sql, /insert into app.codex_migration_history/);
  assert.match(f.writes[2].sql, new RegExp(f.recorded.checksum_sha256));
  assert.doesNotMatch(f.writes[2].sql, /on conflict/i);
});

test("fully applied and matching checkout causes no writes", (t) => {
  const history = [];
  const f = fixture(t, { historyExists: true, history });
  history.push(f.recorded);
  runMigrations([], f.commands);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.logs, ["No pending migrations."]);
});

test("verified history applies only the new migration", (t) => {
  const history = [];
  const f = fixture(t, { historyExists: true, history });
  history.push(f.recorded);
  writeFileSync(path.join(f.commands.cwd, "supabase", "migrations", "002_pending.sql"), "select 2;\n");
  runMigrations([], f.commands);
  assert.deepEqual(f.writes.filter((write) => write.file).map((write) => path.basename(write.file)), ["002_pending.sql"]);
});

test("failed migration is not recorded as applied", (t) => {
  const f = fixture(t, { failFile: true });
  assert.throws(() => runMigrations([], f.commands), /Simulated migration failure/);
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes.filter((write) => write.sql?.includes("insert into app.codex_migration_history")).length, 0);
});
