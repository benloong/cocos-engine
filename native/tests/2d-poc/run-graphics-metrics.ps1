param([ValidateSet('windows','web')][Parameter(Mandatory)][string]$Platform,
      [string]$BinaryDir = (Join-Path $PSScriptRoot 'build/m6-graphics-metrics-release'))
$ErrorActionPreference = 'Stop'
$build = Join-Path $PSScriptRoot 'build'
$fixture = Join-Path $build 'graphics-gpu-project/build'
$workload = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'graphics-metrics-workload.js'))
if ($Platform -eq 'windows') {
    $BinaryDir = (Resolve-Path -LiteralPath $BinaryDir).Path
    $source = Join-Path $fixture 'windows/data'
    $target = Join-Path $BinaryDir 'Resources'
    $file = 'main.js'
    $hook = 'return application.init(cc);'
    $result = Join-Path $BinaryDir 'graphics-metrics.json'
    $install = 'installGraphicsMetrics(cc,' + (($result.Replace('\','/')) | ConvertTo-Json -Compress) + ');'
} else {
    $source = Join-Path $fixture 'web-mobile'
    $target = Join-Path $build 'graphics-metrics-web/app'
    $file = 'index.js'
    $hook = 'return application.init(engine);'
    $install = 'installGraphicsMetrics(engine);'
}
& robocopy $source $target /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -gt 7) { throw 'Resource staging failed' }
$entry = [IO.File]::ReadAllText((Join-Path $source $file))
if ($entry.Split($hook,[StringSplitOptions]::None).Count -ne 2) { throw 'Missing unique application hook' }
[IO.File]::WriteAllText((Join-Path $target $file), $entry.Replace($hook,$workload + [Environment]::NewLine + $install + $hook))
if ($Platform -eq 'web') {
    node (Join-Path $PSScriptRoot 'run-graphics-gpu-web.cjs') --graphics-metrics
    exit $LASTEXITCODE
}
$log = Join-Path $BinaryDir 'graphics-metrics.log'
$start = [DateTime]::UtcNow
$app = Start-Process (Join-Path $BinaryDir 'native-2d-m6-gpu.exe') -WorkingDirectory $BinaryDir -WindowStyle Hidden -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
try {
    while ([DateTime]::UtcNow -lt $start.AddMinutes(3)) {
        if ((Test-Path -LiteralPath $result) -and (Get-Item -LiteralPath $result).LastWriteTimeUtc -gt $start) {
            $data = Get-Content -Raw -LiteralPath $result | ConvertFrom-Json
            if ($data.groups.Count -ne 63 -or $data.controlBytes -ne 4096) { throw 'Incomplete graphics metrics' }
            exit 0
        }
        if ($app.HasExited -or (Select-String -LiteralPath $log -Pattern 'M6_GPU_FAIL' -Quiet)) { throw "Graphics metrics failed. See $log" }
        Start-Sleep -Milliseconds 200
    }
    throw "Graphics metrics timed out. See $log"
} finally { if (!$app.HasExited) { Stop-Process -Id $app.Id } }
