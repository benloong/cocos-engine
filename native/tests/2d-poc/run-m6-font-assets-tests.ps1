param([string[]]$NativeExecutables = @())
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
if ($NativeExecutables.Count -eq 0) {
    $NativeExecutables = @((Join-Path $PSScriptRoot 'native/out/cc2d_native_poc.exe'))
}
& node (Join-Path $PSScriptRoot 'build-font-assets-probe.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Could not generate Font assets JSB probe' }
$probe = Join-Path $PSScriptRoot 'build/font-assets-probe.js'
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
        throw "Font assets JSB probe failed or was not executed: $executable"
    }
}
Push-Location $repoRoot
try {
    & node (Join-Path $repoRoot 'node_modules/jest/bin/jest.js') --runInBand --silent --runTestsByPath `
        (Join-Path $repoRoot 'tests/assets/native-font-assets.test.ts') `
        (Join-Path $repoRoot 'tests/assets/native-font-assets-jit.test.ts') `
        (Join-Path $repoRoot 'tests/core/deserialize.test.ts') `
        (Join-Path $repoRoot 'tests/core/deserialize-jit.test.ts') `
        (Join-Path $repoRoot 'tests/ui/native-2d-m3-label-shell.test.ts') `
        (Join-Path $repoRoot 'tests/ui/font-loader.test.ts') `
        (Join-Path $repoRoot 'tests/ui/font-family.test.ts')
    if ($LASTEXITCODE -ne 0) { throw 'Font assets API/serialization tests failed' }
} finally {
    Pop-Location
}
