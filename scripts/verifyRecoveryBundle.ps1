param(
  [Parameter(Mandatory = $true)]
  [string]$BundleDirectory
)

$ErrorActionPreference = 'Stop'
$bundle = [System.IO.Path]::GetFullPath($BundleDirectory)
if (-not (Test-Path -LiteralPath $bundle -PathType Container)) {
  throw 'Recovery bundle directory does not exist.'
}

$manifestPath = Join-Path $bundle 'recovery-manifest.sha256'
$verifiedPath = Join-Path $bundle 'RESTORE_VERIFIED.txt'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw 'Recovery manifest is missing.'
}
if (-not (Test-Path -LiteralPath $verifiedPath -PathType Leaf)) {
  throw 'Restore verification evidence is missing.'
}

$requiredFiles = @(
  'checksums.sha256',
  'data.sql',
  'history-data.sql',
  'history-schema.sql',
  'managed-triggers.sql',
  'roles.sql',
  'row-counts.txt',
  'schema.sql',
  'RESTORE_VERIFIED.txt'
)

$entries = @{}
foreach ($line in Get-Content -LiteralPath $manifestPath) {
  if ($line -notmatch '^([0-9A-Fa-f]{64})  ([^\\/]+)$') {
    throw 'Recovery manifest contains an invalid or nested entry.'
  }
  $name = $matches[2]
  if ($name -eq 'recovery-manifest.sha256' -or $entries.ContainsKey($name)) {
    throw 'Recovery manifest contains a forbidden or duplicate entry.'
  }
  $entries[$name] = $matches[1]
}

foreach ($name in $requiredFiles) {
  if (-not $entries.ContainsKey($name)) {
    throw "Recovery manifest is missing required file: $name"
  }
}

$checked = 0
foreach ($name in $entries.Keys) {
  $path = Join-Path $bundle $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Checksummed file is missing: $name"
  }
  $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
  if ($actual -ine $entries[$name]) {
    throw "Checksum mismatch: $name"
  }
  $checked++
}

$roles = Get-Content -LiteralPath (Join-Path $bundle 'roles.sql') -Raw
if ($roles -match '(?i)\bPASSWORD\b') {
  throw 'Role dump contains a password token.'
}

$evidence = @{}
foreach ($line in Get-Content -LiteralPath $verifiedPath) {
  if ($line -match '^([A-Z0-9_]+)=(.+)$') {
    $evidence[$matches[1]] = $matches[2]
  }
}

$expectedEvidence = @{
  STATE = 'RESTORE_VERIFIED'
  SELECTED_ROW_COUNTS_MATCH = 'True'
  AUTH_USERS_COUNT_MATCH = 'True'
  NEXA_AUTH_TRIGGER_COUNT = '1'
  ROLE_DUMP_NO_PASSWORDS = 'True'
  CUSTOM_ROLE_COUNT = '0'
  HOSTED_WRITES = 'False'
  DEPLOYED = 'False'
}
foreach ($key in $expectedEvidence.Keys) {
  if (-not $evidence.ContainsKey($key) -or $evidence[$key] -cne $expectedEvidence[$key]) {
    throw "Restore verification evidence failed: $key"
  }
}

foreach ($numericKey in @('MIGRATIONS', 'PUBLIC_TABLE_COUNT', 'PUBLIC_POLICY_COUNT', 'PUBLIC_RLS_TABLE_COUNT')) {
  if (-not $evidence.ContainsKey($numericKey) -or $evidence[$numericKey] -notmatch '^[1-9][0-9]*$') {
    throw "Restore verification evidence is invalid: $numericKey"
  }
}

"RECOVERY_BUNDLE_VERIFIED=True"
"CHECKSUMMED_FILE_COUNT=$checked"
"MIGRATIONS=$($evidence['MIGRATIONS'])"
"PUBLIC_TABLE_COUNT=$($evidence['PUBLIC_TABLE_COUNT'])"
"PUBLIC_POLICY_COUNT=$($evidence['PUBLIC_POLICY_COUNT'])"
"PUBLIC_RLS_TABLE_COUNT=$($evidence['PUBLIC_RLS_TABLE_COUNT'])"
"NEXA_AUTH_TRIGGER_COUNT=$($evidence['NEXA_AUTH_TRIGGER_COUNT'])"
"ROLE_DUMP_NO_PASSWORDS=True"
