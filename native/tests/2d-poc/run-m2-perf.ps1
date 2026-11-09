param(
    [string]$NativeExe = (Join-Path $PSScriptRoot 'native\out-release\cc2d_native_poc.exe'),
    [int]$ThresholdPercent = 30
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $NativeExe)) {
    throw "Release native PoC not found: $NativeExe. Build native/out-release first."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$nativeSamples = @()
$nativePrepareNs = $null
for ($i = 0; $i -lt 5; ++$i) {
    $nativeOutput = & $NativeExe 2>&1
    $nativeSceneMatch = [regex]::Match(($nativeOutput -join "`n"), 'native sprite scene: \d+ sprites, [\d.]+ us total, ([\d.]+) ns/sprite')
    if (-not $nativeSceneMatch.Success) {
        throw "Could not parse native sprite scene benchmark output."
    }
    $nativeSamples += [double]$nativeSceneMatch.Groups[1].Value
    if ($i -eq 0) {
        $nativePrepareMatch = [regex]::Match(($nativeOutput -join "`n"), 'native sprite prepare: ([\d.]+) ns/op')
        if ($nativePrepareMatch.Success) { $nativePrepareNs = [double]$nativePrepareMatch.Groups[1].Value }
    }
}
$nativeSamples = $nativeSamples | Sort-Object
$nativeSceneNs = $nativeSamples[[int][math]::Floor($nativeSamples.Count / 2)]

$jest = Join-Path $repoRoot 'node_modules/.bin/jest.cmd'
if (-not (Test-Path $jest)) {
    throw "Jest not found: $jest"
}

$oldNodeOptions = $env:NODE_OPTIONS
$env:NODE_OPTIONS = '--expose-gc'
$jsSamples = @()
$jsUpdateNs = $null
try {
    for ($i = 0; $i -lt 3; ++$i) {
        $jestOutput = & $jest --config (Join-Path $repoRoot 'jest.config.js') --runInBand 'tests/ui/native-2d-poc-bench.test.ts' 2>&1
        $jsSceneMatch = [regex]::Match(($jestOutput -join "`n"), 'JS sprite scene: \d+ sprites, [\d.]+ us total, ([\d.]+) ns/sprite')
        if (-not $jsSceneMatch.Success) {
            throw "Could not parse JS sprite scene benchmark output."
        }
        $jsSamples += [double]$jsSceneMatch.Groups[1].Value
        if ($i -eq 0) {
            $jsUpdateMatch = [regex]::Match(($jestOutput -join "`n"), 'JS sprite updateRenderer: ([\d.]+) ns/op')
            if ($jsUpdateMatch.Success) { $jsUpdateNs = [double]$jsUpdateMatch.Groups[1].Value }
        }
    }
} finally {
    $env:NODE_OPTIONS = $oldNodeOptions
}
$jsSamples = $jsSamples | Sort-Object
$jsSceneNs = $jsSamples[[int][math]::Floor($jsSamples.Count / 2)]
$improvement = (($jsSceneNs - $nativeSceneNs) / $jsSceneNs) * 100.0

$result = [pscustomobject]@{
    nativeSceneNsPerSprite = $nativeSceneNs
    nativePrepareNs = $nativePrepareNs
    jsSceneNsPerSprite = $jsSceneNs
    jsUpdateRendererNs = $jsUpdateNs
    improvementPercent = [math]::Round($improvement, 1)
    thresholdPercent = $ThresholdPercent
    pass = $improvement -ge $ThresholdPercent
}
$result | ConvertTo-Json -Compress

if (-not $result.pass) {
    Write-Error "Native scene improvement $($result.improvementPercent)% is below $ThresholdPercent%."
    exit 1
}
exit 0
