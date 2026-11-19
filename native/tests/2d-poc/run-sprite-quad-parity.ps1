param([string]$NativeExecutable = (Join-Path $PSScriptRoot 'native/out/cc2d_native_poc.exe'))
$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$nativeExe = (Resolve-Path -LiteralPath $NativeExecutable).Path
$outDir = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host '== Web sprite quad =='
Push-Location $repo
try {
    node (Join-Path $repo 'node_modules/jest/bin/jest.js') --config (Join-Path $repo 'jest.config.js') --runInBand tests/ui/native-2d-poc-quad.test.ts | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Jest quad extraction failed' }
} finally {
    Pop-Location
}

Write-Host '== Native sprite quad =='
Remove-Item -LiteralPath (Join-Path $outDir 'native-sprite-quad.json') -ErrorAction SilentlyContinue
Push-Location $outDir
try {
    $nativeOutput = & $nativeExe
    $nativeExit = $LASTEXITCODE
    $nativeOutput | Set-Content -LiteralPath (Join-Path $outDir 'native-sprite-quad.log')
    if ($nativeExit -ne 0) { $nativeOutput | Write-Output; throw 'native PoC failed' }
} finally {
    Pop-Location
}

Write-Host '== Compare quads =='
node (Join-Path $PSScriptRoot 'compare-sprite-quads.js')
if ($LASTEXITCODE -ne 0) { throw 'sprite quad parity failed' }


