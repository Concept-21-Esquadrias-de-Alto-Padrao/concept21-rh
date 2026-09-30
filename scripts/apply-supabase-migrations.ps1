[CmdletBinding()]
param(
  [switch]$BaselineExisting,
  [switch]$DryRun,
  [string]$MigrationsPath = "supabase/migrations"
)

$ErrorActionPreference = "Stop"

function Invoke-SupabaseSql {
  param(
    [string]$Sql,
    [string]$File
  )

  $arguments = @("supabase", "db", "query", "--linked")
  $tempFile = $null
  if ($File) {
    $arguments += @("--file", $File)
  } else {
    $tempFile = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tempFile, $Sql)
    $arguments += @("--file", $tempFile)
  }

  try {
    & npx.cmd @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Supabase SQL command failed."
    }
  } finally {
    if ($tempFile -and (Test-Path $tempFile)) {
      Remove-Item -LiteralPath $tempFile -Force
    }
  }
}

function Invoke-SupabaseSqlJson {
  param([string]$Sql)

  $output = & npx.cmd supabase db query --linked $Sql 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($output | Out-String)
  }

  return ($output | Out-String | ConvertFrom-Json)
}

function ConvertTo-SqlLiteral {
  param([AllowNull()][string]$Value)

  if ($null -eq $Value) {
    return "null"
  }

  return "'" + $Value.Replace("'", "''") + "'"
}

function Get-Sha256Hash {
  param([string]$Path)

  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
      $hashBytes = $sha256.ComputeHash($stream)
    } finally {
      $stream.Dispose()
    }
  } finally {
    $sha256.Dispose()
  }

  return (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join "")
}

if (-not (Test-Path $MigrationsPath)) {
  throw "Migrations path not found: $MigrationsPath"
}

$historySql = @"
create schema if not exists app;

create table if not exists app.codex_migration_history (
  version text primary key,
  file_name text not null,
  checksum_sha256 text not null,
  execution_mode text not null check (execution_mode in ('baseline', 'applied')),
  applied_at timestamptz not null default now(),
  applied_by text not null default 'codex'
);
"@

if (-not $DryRun) {
  Invoke-SupabaseSql -Sql $historySql
}

$migrations = Get-ChildItem -Path $MigrationsPath -Filter "*.sql" -File | Sort-Object Name
if ($migrations.Count -eq 0) {
  Write-Host "No migration files found."
  exit 0
}

$applied = @{}
$historyExistsResult = Invoke-SupabaseSqlJson -Sql "select to_regclass('app.codex_migration_history') is not null as exists;"
$historyExists = $historyExistsResult.rows[0].exists

if ($historyExists) {
  $historyResult = Invoke-SupabaseSqlJson -Sql "select version from app.codex_migration_history order by version;"
  foreach ($row in $historyResult.rows) {
    $applied[$row.version] = $true
  }
}

$pending = @()
foreach ($migration in $migrations) {
  $version = $migration.BaseName
  if (-not $applied.ContainsKey($version)) {
    $pending += $migration
  }
}

if ($pending.Count -eq 0) {
  Write-Host "No pending migrations."
  exit 0
}

foreach ($migration in $pending) {
  $version = $migration.BaseName
  $checksum = Get-Sha256Hash -Path $migration.FullName
  $mode = if ($BaselineExisting) { "baseline" } else { "applied" }

  Write-Host "Pending migration: $($migration.Name) [$mode]"

  if ($DryRun) {
    continue
  }

  if (-not $BaselineExisting) {
    Invoke-SupabaseSql -File $migration.FullName
  }

  $recordSql = @"
insert into app.codex_migration_history (
  version,
  file_name,
  checksum_sha256,
  execution_mode,
  applied_by
) values (
  $(ConvertTo-SqlLiteral $version),
  $(ConvertTo-SqlLiteral $migration.Name),
  $(ConvertTo-SqlLiteral $checksum),
  $(ConvertTo-SqlLiteral $mode),
  'codex'
)
on conflict (version) do update
set
  file_name = excluded.file_name,
  checksum_sha256 = excluded.checksum_sha256,
  execution_mode = excluded.execution_mode,
  applied_by = excluded.applied_by;
"@

  Invoke-SupabaseSql -Sql $recordSql
}

Write-Host "Migration sync complete."
