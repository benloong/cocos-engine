$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$nodeModules = Join-Path $repoRoot 'node_modules'

Write-Host '== C++ pure logic =='
& (Join-Path $PSScriptRoot 'run-poc-tests.ps1')
if ($LASTEXITCODE -ne 0) {
    throw "C++ PoC tests failed with exit code $LASTEXITCODE"
}

Write-Host '== PNG comparison helper =='
node (Join-Path $PSScriptRoot 'test-compare-png.js')
if ($LASTEXITCODE -ne 0) {
    throw "PNG comparison tests failed with exit code $LASTEXITCODE"
}

Write-Host '== Visual report harness =='
node (Join-Path $PSScriptRoot 'test-visual-check.js')
if ($LASTEXITCODE -ne 0) {
    throw "Visual report tests failed with exit code $LASTEXITCODE"
}

Write-Host '== Thin-shell contract =='
node (Join-Path $PSScriptRoot 'check-thin-shell.js')
if ($LASTEXITCODE -ne 0) {
    throw "Thin-shell contract failed with exit code $LASTEXITCODE"
}

Write-Host '== M1 shells =='
node (Join-Path $PSScriptRoot 'check-m1-shells.js')
if ($LASTEXITCODE -ne 0) {
    throw "M1 shell checks failed with exit code $LASTEXITCODE"
}

if (Test-Path (Join-Path $PSScriptRoot 'native\out\cc2d_native_poc.exe')) {
    Write-Host '== Web/native sprite quad parity =='
    & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'run-sprite-quad-parity.ps1')
    if ($LASTEXITCODE -ne 0) {
        throw "Sprite quad parity failed with exit code $LASTEXITCODE"
    }
}

if ($env:CC_M2_APP_EXE) {
    Write-Host '== M2 RenderTexture pixel probe =='
    & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'run-m2-pixel-probe.ps1') -Exe $env:CC_M2_APP_EXE
    if ($LASTEXITCODE -ne 0) {
        throw "M2 pixel probe failed with exit code $LASTEXITCODE"
    }
} else {
    Write-Host 'skip M2 pixel probe: set CC_M2_APP_EXE to cocos-m1-test.exe'
}

$tsc = Join-Path $nodeModules '.bin/tsc.cmd'
if (Test-Path $tsc) {
    Write-Host '== TypeScript typecheck =='
    & $tsc --noEmit -p (Join-Path $repoRoot 'tsconfig.json')
    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript typecheck failed with exit code $LASTEXITCODE"
    }
} else {
    Write-Host 'skip TypeScript typecheck: node_modules/.bin/tsc not found'
}

$jest = Join-Path $nodeModules '.bin/jest.cmd'
if (Test-Path $jest) {
    Write-Host '== Jest (UI + PoC registration) =='
    $oldNodeOptions = $env:NODE_OPTIONS
    $env:NODE_OPTIONS = '--expose-gc'
    try {
        & $jest --config (Join-Path $repoRoot 'jest.config.js') --runInBand `
            'tests/ui/ui-transform.test.ts' `
            'tests/ui/sprite.test.ts' `
            'tests/ui/native-2d-poc.test.ts' `
            'tests/ui/native-2d-m1-shell.test.ts' `
            'tests/ui/native-2d-poc-bench.test.ts'
        if ($LASTEXITCODE -ne 0) {
            throw "Jest failed with exit code $LASTEXITCODE"
        }
    } finally {
        $env:NODE_OPTIONS = $oldNodeOptions
    }
} else {
    Write-Host 'skip Jest: node_modules/.bin/jest not found'
}

Write-Host 'M0 checks passed.'
