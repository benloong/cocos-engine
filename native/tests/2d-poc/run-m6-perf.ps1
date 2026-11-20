param([ValidateSet('before','after','web')][Parameter(Mandatory)][string]$Target, [string]$BinaryDirectory, [switch]$TextWidthProbe, [ValidatePattern('^[0-9a-f]{10}$')][string]$ProjectRevision, [switch]$LabelRasterProbe, [string]$ResourceTemplateDirectory)
$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot 'build'
$key = if ($Target -eq 'web') { 'after' } else { $Target }
$projectName = if ($ProjectRevision) { "perf-project-$key-$ProjectRevision" } else { "perf-project-$key" }
$project = Join-Path $dir "$projectName/build"
$fixture = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'm6-perf-workloads.js'))
if ($LabelRasterProbe) {
    if ($Target -eq 'web') { throw 'The Label raster probe uses Windows texture readback' }
    $marker = 'if (textWidthProbe) {'
    if ($fixture.Split($marker, [StringSplitOptions]::None).Count -ne 2) { throw 'Missing post-workload probe entry' }
    $probe = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'test-label-line-raster.js'))
    $fixture = $probe + [Environment]::NewLine + $fixture.Replace($marker, 'result.lineRasterVariants = await checkLabelLineRaster(cc, canvas, nextFrame);' + [Environment]::NewLine + $marker)
}
if ($Target -eq 'web') {
    if ($ResourceTemplateDirectory) { throw 'Shared resource staging is Windows only' }
    $file = Join-Path $project 'web-mobile/index.js'
    $original = Join-Path $dir 'graphics-gpu-project/build/web-mobile/index.js'
    $hook = 'return application.init(engine);'
    $install = 'installM6Perf(engine, null);'
} else {
    $bin = if ($BinaryDirectory) { (Resolve-Path -LiteralPath $BinaryDirectory).Path } else { Join-Path $dir "perf-bin-$key" }
    $exe = (Resolve-Path (Join-Path $bin 'native-2d-m6-gpu.exe')).Path
    $data = Join-Path $project 'windows/data'
    $resources = Join-Path $bin 'Resources'
    $scene = if ($ResourceTemplateDirectory) { (Resolve-Path -LiteralPath $ResourceTemplateDirectory).Path } else { $data }
    if ($ResourceTemplateDirectory) {
        & robocopy $scene $resources /E /XD 'cocos-js' /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -gt 7) { throw 'Shared scene staging failed' }
        & robocopy (Join-Path $data 'src/cocos-js') (Join-Path $resources 'src/cocos-js') /E /NFL /NDL /NJH /NJS /NP | Out-Null
    } else {
        & robocopy $scene $resources /E /NFL /NDL /NJH /NJS /NP | Out-Null
    }
    if ($LASTEXITCODE -gt 7) { throw 'Resource staging failed' }
    $file = Join-Path $resources 'main.js'
    $original = Join-Path $scene 'main.js'
    $result = (Join-Path $dir "m6-perf-$key-results.json").Replace('\','/')
    $hook = 'return application.init(cc);'
    $install = 'installM6Perf(cc,' + (ConvertTo-Json -InputObject $result -Compress) + ',' + $TextWidthProbe.IsPresent.ToString().ToLowerInvariant() + ');'
}
$entry = [IO.File]::ReadAllText($original)
if ($entry.Split($hook, [StringSplitOptions]::None).Count -ne 2) { throw 'Cannot identify unique benchmark entry' }
[IO.File]::WriteAllText($file, $entry.Replace($hook, $fixture + [Environment]::NewLine + $install + $hook))
if ($Target -eq 'web') {
    node (Join-Path $PSScriptRoot 'run-graphics-gpu-web.cjs') --perf "--project=$projectName"
    exit $LASTEXITCODE
}
$log = Join-Path $dir "m6-perf-$key.log"
$since = [DateTime]::UtcNow
$app = Start-Process $exe -WorkingDirectory $bin -WindowStyle Hidden -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
try {
    while ([DateTime]::UtcNow -lt $since.AddMinutes(4)) {
        Start-Sleep -Milliseconds 350
        if ((Test-Path -LiteralPath $result) -and (Get-Item -LiteralPath $result).LastWriteTimeUtc -gt $since) {
            $data = Get-Content -Raw -LiteralPath $result | ConvertFrom-Json
            if ($data.cases.Count -ne 12 -or @($data.cases | Where-Object {$_.samples.Count -ne 120}).Count) { throw 'Incomplete benchmark' }
            if ($LabelRasterProbe -and $data.lineRasterVariants -lt 1) { throw 'Missing Label raster comparisons' }
            Write-Output "M6_PERF_READY $key"
            exit 0
        }
        if ($app.HasExited -or (Select-String -LiteralPath $log -Pattern 'M6_GPU_FAIL|TypeError:|ReferenceError:' -Quiet)) {
            throw "Benchmark failed. See $log"
        }
    }
    throw "Benchmark timed out. See $log"
} finally { if (!$app.HasExited) { Stop-Process -Id $app.Id } }
