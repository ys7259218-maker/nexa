$ErrorActionPreference = 'Stop'
$verifier = Join-Path $PSScriptRoot 'verifyRecoveryBundle.ps1'
$tempDirectory = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$bundle = Join-Path $tempDirectory ('nexa-recovery-verifier-test-' + [guid]::NewGuid().ToString('N'))
$bundle = [System.IO.Path]::GetFullPath($bundle)

# This test owns only its freshly named temporary directory. Keep cleanup
# constrained even if a future edit changes how the path is constructed.
$safePrefix = $tempDirectory.TrimEnd([char[]]@('/', '\')) + [System.IO.Path]::DirectorySeparatorChar
if (-not $bundle.StartsWith($safePrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
    -not [System.IO.Path]::GetFileName($bundle).StartsWith('nexa-recovery-verifier-test-')) {
  throw 'Synthetic recovery test path is outside the expected temporary directory.'
}

$requiredFiles = @(
  'checksums.sha256', 'data.sql', 'history-data.sql', 'history-schema.sql',
  'managed-triggers.sql', 'roles.sql', 'row-counts.txt', 'schema.sql',
  'RESTORE_VERIFIED.txt'
)

function Write-Manifest {
  $lines = foreach ($name in $requiredFiles) {
    $hash = (Get-FileHash -LiteralPath (Join-Path $bundle $name) -Algorithm SHA256).Hash
    "$hash  $name"
  }
  Set-Content -LiteralPath (Join-Path $bundle 'recovery-manifest.sha256') -Value $lines
}

function Assert-Rejected([string]$caseName) {
  $rejected = $false
  try {
    & $verifier -BundleDirectory $bundle | Out-Null
  } catch {
    $rejected = $true
  }
  if (-not $rejected) {
    throw "Recovery verifier accepted unsafe synthetic case: $caseName"
  }
}

try {
  New-Item -ItemType Directory -Path $bundle -ErrorAction Stop | Out-Null
  foreach ($name in $requiredFiles) {
    Set-Content -LiteralPath (Join-Path $bundle $name) -Value 'synthetic fixture only'
  }
  Set-Content -LiteralPath (Join-Path $bundle 'roles.sql') -Value 'CREATE ROLE synthetic_fixture;'
  Set-Content -LiteralPath (Join-Path $bundle 'RESTORE_VERIFIED.txt') -Value @(
    'STATE=RESTORE_VERIFIED',
    'SELECTED_ROW_COUNTS_MATCH=True',
    'AUTH_USERS_COUNT_MATCH=True',
    'NEXA_AUTH_TRIGGER_COUNT=1',
    'ROLE_DUMP_NO_PASSWORDS=True',
    'CUSTOM_ROLE_COUNT=0',
    'HOSTED_WRITES=False',
    'DEPLOYED=False',
    'MIGRATIONS=1',
    'PUBLIC_TABLE_COUNT=1',
    'PUBLIC_POLICY_COUNT=1',
    'PUBLIC_RLS_TABLE_COUNT=1'
  )
  Write-Manifest

  $result = @(& $verifier -BundleDirectory $bundle)
  if ('RECOVERY_BUNDLE_VERIFIED=True' -notin $result) {
    throw 'Recovery verifier rejected a valid synthetic flat bundle.'
  }

  $strayPath = Join-Path $bundle 'unlisted-secret.txt'
  Set-Content -LiteralPath $strayPath -Value 'synthetic, not a real secret'
  Assert-Rejected 'unlisted file'
  Remove-Item -LiteralPath $strayPath

  $nestedPath = Join-Path $bundle 'unlisted-directory'
  New-Item -ItemType Directory -Path $nestedPath | Out-Null
  Assert-Rejected 'nested directory'
  Remove-Item -LiteralPath $nestedPath

  $linkPath = Join-Path $bundle 'linked-data.sql'
  $linkCreated = $false
  try {
    New-Item -ItemType SymbolicLink -Path $linkPath -Target (Join-Path $bundle 'data.sql') |
      Out-Null
    $linkCreated = $true
  } catch {
    if (-not $IsWindows) { throw }
  }
  if ($linkCreated) {
    $linkHash = (Get-FileHash -LiteralPath $linkPath -Algorithm SHA256).Hash
    Add-Content -LiteralPath (Join-Path $bundle 'recovery-manifest.sha256') -Value (
      "$linkHash  linked-data.sql"
    )
    Assert-Rejected 'checksummed symbolic link'
    Remove-Item -LiteralPath $linkPath
    Write-Manifest
  }

  Add-Content -LiteralPath (Join-Path $bundle 'recovery-manifest.sha256') -Value (
    ('0' * 64) + '  unsafe:stream'
  )
  Assert-Rejected 'unsafe alternate-data-stream filename'
  Write-Manifest

  Add-Content -LiteralPath (Join-Path $bundle 'data.sql') -Value 'tampered fixture'
  Assert-Rejected 'checksum mismatch'

  'RECOVERY_VERIFIER_SYNTHETIC_TESTS_PASSED=True'
} finally {
  if (Test-Path -LiteralPath $bundle -PathType Container) {
    Remove-Item -LiteralPath $bundle -Recurse -Force
  }
}
