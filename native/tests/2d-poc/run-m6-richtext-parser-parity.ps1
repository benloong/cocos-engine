param([string[]]$NativeExecutables = @())
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$outDir = Join-Path $PSScriptRoot 'build'
& node (Join-Path $PSScriptRoot 'build-richtext-parser-cases.cjs')
if ($LASTEXITCODE -ne 0) { throw 'RichText parser fixture generation failed' }
$exe = Join-Path $outDir 'richtext-parser.exe'
& g++ -std=c++17 -O2 -I (Join-Path $repoRoot 'native/cocos') -isystem (Join-Path $repoRoot 'native/external/sources') `
    (Join-Path $PSScriptRoot 'test_richtext_parser.cpp') `
    (Join-Path $repoRoot 'native/cocos/2d/renderer/RichTextParser.cpp') -o $exe
if ($LASTEXITCODE -ne 0) { throw 'RichText parser standalone build failed' }
$inputs = Join-Path $outDir 'richtext-parser-input.json'
$backends = @()
foreach ($item in @($exe) + $NativeExecutables) {
    $executable = (Resolve-Path -LiteralPath $item).Path
    $nativeOutput = & $executable $inputs
    if ($LASTEXITCODE -ne 0) { throw "Native RichText parser failed: $executable" }
    $name = ConvertTo-Json -Compress $executable
    $backends += '{"name":' + $name + ',"outputs":' + ($nativeOutput -join "`n") + '}'
}
$result = Join-Path $outDir 'richtext-parser-result.json'
[System.IO.File]::WriteAllText($result, '{"inputs":' + [System.IO.File]::ReadAllText($inputs) + ',"backends":[' + ($backends -join ',') + '],"historical":' + [System.IO.File]::ReadAllText((Join-Path $outDir 'richtext-parser-historical.json')) + '}')
$previous = $env:CC_RICHTEXT_PARSER_FIXTURE
try {
    $env:CC_RICHTEXT_PARSER_FIXTURE = $result
    Push-Location $repoRoot
    try {
        & node (Join-Path $repoRoot 'node_modules/jest/bin/jest.js') --silent --runInBand --runTestsByPath (Join-Path $repoRoot 'tests/ui/native-richtext-parser-parity.test.ts')
        if ($LASTEXITCODE -ne 0) { throw 'Web/native RichText parser parity failed' }
    } finally { Pop-Location }
} finally { $env:CC_RICHTEXT_PARSER_FIXTURE = $previous }
