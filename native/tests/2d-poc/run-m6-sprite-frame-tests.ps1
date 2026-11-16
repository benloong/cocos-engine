$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$outDir = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$exe = Join-Path $outDir 'sprite-frame-data.exe'
& g++ -std=c++17 -O2 -I (Join-Path $repoRoot 'native/cocos') (Join-Path $PSScriptRoot 'test_sprite_frame_data.cpp') -o $exe
if ($LASTEXITCODE -ne 0) { throw 'SpriteFrame C++ compilation failed' }
$fixture = & $exe
if ($LASTEXITCODE -ne 0) { throw 'SpriteFrame C++ assertions failed' }
$fixturePath = Join-Path $outDir 'sprite-frame-uv.json'
[System.IO.File]::WriteAllText($fixturePath, ($fixture -join "`n"))
$previousFixture = $env:CC_SPRITE_FRAME_UV_FIXTURE
try {
    $env:CC_SPRITE_FRAME_UV_FIXTURE = $fixturePath
    Push-Location $repoRoot
    try {
        & node (Join-Path $repoRoot 'node_modules/jest/bin/jest.js') --runInBand --runTestsByPath (Join-Path $repoRoot 'tests/ui/native-sprite-frame-uv-parity.test.ts')
        if ($LASTEXITCODE -ne 0) { throw 'SpriteFrame Web/native UV parity failed' }
    } finally {
        Pop-Location
    }
} finally {
    $env:CC_SPRITE_FRAME_UV_FIXTURE = $previousFixture
}
