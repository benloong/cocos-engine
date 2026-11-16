$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$nodeModules = Join-Path $repoRoot 'node_modules'

Write-Host '== Generated native 2D metadata =='
& node (Join-Path $repoRoot 'scripts/generate-native-2d-decorators.cjs') --check
if ($LASTEXITCODE -ne 0) { throw 'Native 2D metadata is stale' }
& node --test (Join-Path $repoRoot 'tests/scripts/native-2d-decorators.test.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Native 2D metadata generator tests failed' }

Write-Host '== M6 API and dependency baseline =='
& node (Join-Path $PSScriptRoot 'audit-m6.cjs') --check
if ($LASTEXITCODE -ne 0) { throw 'M6 API baseline is stale' }
& node --test (Join-Path $repoRoot 'tests/scripts/native-2d-audit.test.cjs')
if ($LASTEXITCODE -ne 0) { throw 'M6 audit tool tests failed' }

Write-Host '== C++ pure logic =='
& (Join-Path $PSScriptRoot 'run-poc-tests.ps1')
if ($LASTEXITCODE -ne 0) {
    throw "C++ PoC tests failed with exit code $LASTEXITCODE"
}

Write-Host '== M6.1 SpriteFrame Web/native UV parity =='
& (Join-Path $PSScriptRoot 'run-m6-sprite-frame-tests.ps1')
if ($LASTEXITCODE -ne 0) {
    throw "SpriteFrame parity tests failed with exit code $LASTEXITCODE"
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
    Write-Host '== M6.1 SpriteAtlas JSB/native table consistency =='
    & (Join-Path $PSScriptRoot 'run-m6-sprite-atlas-tests.ps1')
    if ($LASTEXITCODE -ne 0) {
        throw "SpriteAtlas consistency tests failed with exit code $LASTEXITCODE"
    }
    Write-Host '== M6.1 font asset data and lifecycle =='
    & (Join-Path $PSScriptRoot 'run-m6-sprite-api-tests.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Sprite API tests failed' }
    & (Join-Path $PSScriptRoot 'run-m6-layout-tests.ps1')
    if ($LASTEXITCODE -ne 0) { throw "Layout ownership tests failed" }
    & (Join-Path $PSScriptRoot 'run-m6-font-assets-tests.ps1')
    if ($LASTEXITCODE -ne 0) { throw "Font asset tests failed with exit code $LASTEXITCODE" }
}

if ($env:CC_M2_APP_EXE) {
    Write-Host '== M2 RenderTexture pixel probe =='
    & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'run-m2-pixel-probe.ps1') -Exe $env:CC_M2_APP_EXE
    if ($LASTEXITCODE -ne 0) {
        throw "M2 pixel probe failed with exit code $LASTEXITCODE"
    }

    Write-Host '== M3 Label texture probe =='
    & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'run-m3-label-probe.ps1') -AppExe $env:CC_M2_APP_EXE
    if ($LASTEXITCODE -ne 0) {
        throw "M3 Label probe failed with exit code $LASTEXITCODE"
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
            'tests/ui/native-2d-poc-bench.test.ts' `
            'tests/ui/native-2d-m2-sprite-shell.test.ts' `
            'tests/ui/native-2d-m2-sprite-frame-shell.test.ts' `
            'tests/ui/native-2d-m3-label-shell.test.ts'
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
