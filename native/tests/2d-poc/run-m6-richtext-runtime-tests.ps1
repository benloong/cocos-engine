param([string[]]$NativeExecutables = @())
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
if ($NativeExecutables.Count -eq 0) { $NativeExecutables = @((Join-Path $PSScriptRoot 'native/out/cc2d_native_poc.exe')) }
& node (Join-Path $PSScriptRoot 'build-richtext-runtime-probe.cjs')
if ($LASTEXITCODE -ne 0) { throw 'RichText JSB probe generation failed' }
$probe = Join-Path $PSScriptRoot 'build/richtext-runtime-probe.js'
foreach ($item in $NativeExecutables) {
    $executable = (Resolve-Path -LiteralPath $item).Path
    Push-Location -LiteralPath (Split-Path -Parent $executable)
    try { $output = & $executable $probe; $exitCode = $LASTEXITCODE } finally { Pop-Location }
    $output | Write-Output
    if ($exitCode -ne 0 -or ($output -join "`n") -notmatch 'jsb shell integration: OK') { throw "RichText JSB probe failed: $executable" }
}
Push-Location $repoRoot
try {
    & node (Join-Path $repoRoot 'node_modules/jest/bin/jest.js') --silent --runInBand --runTestsByPath `
        (Join-Path $repoRoot 'tests/ui/native-2d-m6-richtext-shell.test.ts') `
        (Join-Path $repoRoot 'tests/scene-graph/native-node-constructor.test.ts') `
        (Join-Path $repoRoot 'tests/ui/richtext.test.ts')
    if ($LASTEXITCODE -ne 0) { throw 'RichText shell/Web API tests failed' }
} finally {
    Pop-Location
}
