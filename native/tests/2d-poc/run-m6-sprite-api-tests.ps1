param([string[]]$NativeExecutables = @())
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
if ($NativeExecutables.Count -eq 0) {
    $NativeExecutables = @((Join-Path $PSScriptRoot 'native/out/cc2d_native_poc.exe'))
}
& node (Join-Path $PSScriptRoot 'build-sprite-api-probe.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Could not generate Sprite API JSB probe' }
$probe = Join-Path $PSScriptRoot 'build/sprite-api-probe.js'
foreach ($item in $NativeExecutables) {
    $executable = (Resolve-Path -LiteralPath $item).Path
    Push-Location -LiteralPath (Split-Path -Parent $executable)
    try {
        $output = & $executable $probe
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    $output | Write-Output
    if ($exitCode -ne 0 -or ($output -join "`n") -notmatch 'jsb shell integration: OK') {
        throw "Sprite API JSB probe failed or was not executed: $executable"
    }
}
Push-Location $repoRoot
try {
    & node (Join-Path $repoRoot 'node_modules/jest/bin/jest.js') --runInBand --silent --runTestsByPath `
        (Join-Path $repoRoot 'tests/ui/native-2d-m2-sprite-shell.test.ts') `
        (Join-Path $repoRoot 'tests/ui/native-2d-m3-label-shell.test.ts') `
        (Join-Path $repoRoot 'tests/ui/native-2d-m2-sprite-frame-shell.test.ts') `
        (Join-Path $repoRoot 'tests/assets/native-material-instance.test.ts')
    if ($LASTEXITCODE -ne 0) { throw 'Sprite/Label material API/serialization tests failed' }
} finally {
    Pop-Location
}
