param(
    [Parameter(Mandatory)][string]$AppExe,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [int]$TimeoutSeconds = 120,
    [string]$Declarations = (Join-Path $PSScriptRoot '../../../bin/.declarations/cc.d.ts')
)
$ErrorActionPreference = 'Stop'
$exe = Get-Item -LiteralPath $AppExe
if (Test-Path -LiteralPath $OutputDirectory) { throw "Use a new output directory: $OutputDirectory" }
$stage = (New-Item -ItemType Directory -Path $OutputDirectory).FullName
Copy-Item -LiteralPath $exe.FullName -Destination $stage
Get-ChildItem -LiteralPath $exe.DirectoryName -Filter '*.dll' -File | Copy-Item -Destination $stage
Copy-Item -LiteralPath (Join-Path $exe.DirectoryName 'Resources') -Destination $stage -Recurse

$resources = Join-Path $stage 'Resources'
& node (Join-Path $PSScriptRoot 'build-public-api-inventory.cjs') (Join-Path $resources 'm1-m5-public-members.json') (Resolve-Path -LiteralPath $Declarations).Path
if ($LASTEXITCODE -ne 0) { throw 'Could not collect current public members' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'fixtures/acceptance/M1M5PublicApi.js') -Destination $resources
$report = Join-Path $stage 'checks.json'
$jsonPath = $report.Replace('\', '/') | ConvertTo-Json -Compress
$main = Join-Path $resources 'main.js'
$source = [IO.File]::ReadAllText($main)
$hook = 'return application.start();'
if ([regex]::Matches($source, [regex]::Escape($hook)).Count -ne 1) { throw 'Expected one application.start hook' }
$replacement = "return System.import('cc').then(cc => { require('M1M5PublicApi.js'); globalThis.installM1M5PublicApi(cc, $jsonPath); return application.start(); });"
[IO.File]::WriteAllText($main, $source.Replace($hook, $replacement))
$process = Start-Process -FilePath (Join-Path $stage $exe.Name) -WorkingDirectory $stage -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $stage 'stdout.log') -RedirectStandardError (Join-Path $stage 'stderr.log') -PassThru
try {
    if (!$process.WaitForExit($TimeoutSeconds * 1000)) { throw 'Timed out waiting for public API checks' }
    if ($process.ExitCode -ne 0) { throw "Application exited with $($process.ExitCode)" }
} finally {
    if (!$process.HasExited) { $process.Kill(); $process.WaitForExit() }
    $process.Dispose()
}

$checks = @(Get-Content -LiteralPath $report -Raw | ConvertFrom-Json)
$expected = 'publicMembers', 'M1.cameraCenter', 'M1.activeWindow', 'Sprite.priority', 'Label.priority', 'Graphics.priority', 'Mask.isHit.bare', 'Mask.isHit.control', 'Graphics.impl'
if (Compare-Object $expected @($checks.name)) { throw 'Incomplete public API report' }
$failed = @($checks | Where-Object { $_.passed -ne $true })
if ($failed.Count) { throw "Failed public API checks: $($failed.name -join ', '). See $report" }
Write-Output "M1–M5 public API checks passed. See $report"
