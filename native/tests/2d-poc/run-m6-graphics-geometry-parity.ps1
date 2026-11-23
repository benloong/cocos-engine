param([string[]]$NativeExecutables = @())
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$outDir = Join-Path $PSScriptRoot 'build'
& node (Join-Path $PSScriptRoot 'build-graphics-geometry-cases.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Graphics geometry fixture generation failed' }
$exe = Join-Path $outDir 'graphics-geometry.exe'
& g++ -std=c++17 -O2 -I (Join-Path $repoRoot 'native/cocos') -isystem (Join-Path $repoRoot 'native/external/sources') `
    (Join-Path $PSScriptRoot 'test_graphics_geometry.cpp') `
    (Join-Path $repoRoot 'native/cocos/2d/geometry/GraphicsGeometry.cpp') `
    (Join-Path $repoRoot 'native/cocos/2d/geometry/GraphicsEarcut.cpp') -o $exe
if ($LASTEXITCODE -ne 0) { throw 'Graphics geometry build failed' }
$inputPath = Join-Path $outDir 'graphics-geometry-input.json'
$backends = @()
foreach ($item in @($exe) + $NativeExecutables) {
    $executable = (Resolve-Path -LiteralPath $item).Path
    $output = & $executable $inputPath
    if ($LASTEXITCODE -ne 0) { throw "Native Graphics geometry failed: $executable" }
    $name = ConvertTo-Json -Compress $executable
    $backends += '{"name":' + $name + ',"outputs":' + ($output -join "`n") + '}'
}
$result = Join-Path $outDir 'graphics-geometry-result.json'
[System.IO.File]::WriteAllText($result, '{"inputs":' + [System.IO.File]::ReadAllText($inputPath) + ',"backends":[' + ($backends -join ',') + ']}')
$previous = $env:CC_GRAPHICS_GEOMETRY_FIXTURE
try {
    $env:CC_GRAPHICS_GEOMETRY_FIXTURE = $result
    Push-Location $repoRoot
    try {
        & node (Join-Path $repoRoot 'node_modules/jest/bin/jest.js') --silent --runInBand --runTestsByPath (Join-Path $repoRoot 'tests/ui/native-graphics-geometry-parity.test.ts')
        if ($LASTEXITCODE -ne 0) { throw 'Web/native Graphics geometry parity failed' }
    } finally {
        Pop-Location
    }
} finally { $env:CC_GRAPHICS_GEOMETRY_FIXTURE = $previous }
