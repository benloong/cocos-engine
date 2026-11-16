param([string[]]$NativeExecutables = @())
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$outDir = Join-Path $PSScriptRoot 'build'
& node (Join-Path $PSScriptRoot 'build-richtext-layout-cases.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Layout fixture generation failed' }
$exe = Join-Path $outDir 'richtext-layout.exe'
& g++ -std=c++17 -O2 -I (Join-Path $repoRoot 'native/cocos') -isystem (Join-Path $repoRoot 'native/external/sources') `
    (Join-Path $PSScriptRoot 'test_richtext_layout.cpp') `
    (Join-Path $repoRoot 'native/cocos/2d/renderer/RichTextParser.cpp') `
    (Join-Path $repoRoot 'native/cocos/2d/renderer/RichTextLayout.cpp') -o $exe
if ($LASTEXITCODE -ne 0) { throw 'RichText layout build failed' }
$inputPath = Join-Path $outDir 'richtext-layout-input.json'
$backends = @()
foreach ($item in @($exe) + $NativeExecutables) {
    $executable = (Resolve-Path -LiteralPath $item).Path
    $output = & $executable $inputPath
    if ($LASTEXITCODE -ne 0) { throw "Native RichText layout failed: $executable" }
    $name = ConvertTo-Json -Compress $executable
    $backends += '{"name":' + $name + ',"outputs":' + ($output -join "`n") + '}'
}
$result = Join-Path $outDir 'richtext-layout-result.json'
[System.IO.File]::WriteAllText($result, '{"inputs":' + [System.IO.File]::ReadAllText($inputPath) + ',"backends":[' + ($backends -join ',') + ']}')
$previous = $env:CC_RICHTEXT_LAYOUT_FIXTURE
try {
    $env:CC_RICHTEXT_LAYOUT_FIXTURE = $result
    Push-Location $repoRoot
    try {
        & node (Join-Path $repoRoot 'node_modules/jest/bin/jest.js') --silent --runInBand --runTestsByPath (Join-Path $repoRoot 'tests/ui/native-richtext-layout-parity.test.ts')
        if ($LASTEXITCODE -ne 0) { throw 'Web/native RichText layout parity failed' }
    } finally { Pop-Location }
} finally { $env:CC_RICHTEXT_LAYOUT_FIXTURE = $previous }
