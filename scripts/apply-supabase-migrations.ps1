[CmdletBinding()]
param(
  [switch]$BaselineExisting,
  [switch]$DryRun,
  [string]$MigrationsPath = "supabase/migrations"
)

$ErrorActionPreference = "Stop"

Write-Warning "scripts/apply-supabase-migrations.ps1 is deprecated. Calling the Node migration runner."

$arguments = @("scripts/apply-supabase-migrations.mjs")

if ($BaselineExisting) {
  $arguments += "--baseline-existing"
}

if ($DryRun) {
  $arguments += "--dry-run"
}

if ($MigrationsPath -ne "supabase/migrations") {
  $arguments += @("--migrations-path", $MigrationsPath)
}

& node @arguments

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
