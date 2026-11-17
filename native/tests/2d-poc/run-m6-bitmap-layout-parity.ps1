param([string[]]$NativeExecutables = @())
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$outDir = Join-Path $PSScriptRoot 'build'
& node (Join-Path $PSScriptRoot 'build-bitmap-layout-cases.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Bitmap layout fixture generation failed' }
$exe = Join-Path $outDir 'bitmap-layout.exe'
& g++ -std=c++17 -O2 -I (Join-Path $repoRoot 'native/cocos') -isystem (Join-Path $repoRoot 'native/external/sources') (Join-Path $PSScriptRoot 'test_bitmap_layout.cpp') -o $exe
if ($LASTEXITCODE -ne 0) { throw 'Bitmap layout build failed' }
$inputPath = Join-Path $outDir 'bitmap-layout-input.json'
$backends = @()
foreach ($item in @($exe) + $NativeExecutables) {
    $executable = (Resolve-Path -LiteralPath $item).Path
    $output = & $executable $inputPath
    if ($LASTEXITCODE -ne 0) { throw "Bitmap layout failed: $executable" }
    $name = ConvertTo-Json -Compress $executable
    $backends += '{"name":' + $name + ',"outputs":' + ($output -join [Environment]::NewLine) + '}'
}
$result = Join-Path $outDir 'bitmap-layout-result.json'
[System.IO.File]::WriteAllText($result, '{"inputs":' + [System.IO.File]::ReadAllText($inputPath) + ',"backends":[' + ($backends -join ',') + ']}')
$previous = $env:CC_BITMAP_LAYOUT_FIXTURE
try {
    $env:CC_BITMAP_LAYOUT_FIXTURE = $result
    Push-Location $repoRoot
    try {
        & node (Join-Path $repoRoot 'node_modules/jest/bin/jest.js') --silent --runInBand --runTestsByPath (Join-Path $repoRoot 'tests/ui/native-bitmap-layout-parity.test.ts')
        if ($LASTEXITCODE -ne 0) { throw 'Web/native bitmap layout parity failed' }
    } finally { Pop-Location }
} finally { $env:CC_BITMAP_LAYOUT_FIXTURE = $previous }
