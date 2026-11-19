param([ValidateSet('before','after','web')][Parameter(Mandatory)][string]$Target, [string]$BinaryDirectory)
$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot 'build'
$key = if ($Target -eq 'web') { 'after' } else { $Target }
$project = Join-Path $dir "perf-project-$key/build"
$fixture = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'm6-perf-workloads.js'))
if ($Target -eq 'web') {
    $file = Join-Path $project 'web-mobile/index.js'
    $original = Join-Path $dir 'graphics-gpu-project/build/web-mobile/index.js'
    $hook = 'return application.init(engine);'
    $install = 'installM6Perf(engine, null);'
} else {
    $bin = if ($BinaryDirectory) { (Resolve-Path -LiteralPath $BinaryDirectory).Path } else { Join-Path $dir "perf-bin-$key" }
    $exe = (Resolve-Path (Join-Path $bin 'native-2d-m6-gpu.exe')).Path
    & robocopy "$project/windows/data" "$bin/Resources" /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -gt 7) { throw 'Resource staging failed' }
    $file = Join-Path $bin 'Resources/main.js'
    $original = Join-Path $project 'windows/data/main.js'
    $result = (Join-Path $dir "m6-perf-$key-results.json").Replace('\','/')
    $hook = 'return application.init(cc);'
    $install = 'installM6Perf(cc,' + (ConvertTo-Json -InputObject $result -Compress) + ');'
}
$entry = [IO.File]::ReadAllText($original)
if ($entry.Split($hook, [StringSplitOptions]::None).Count -ne 2) { throw 'Cannot identify unique benchmark entry' }
[IO.File]::WriteAllText($file, $entry.Replace($hook, $fixture + [Environment]::NewLine + $install + $hook))
if ($Target -eq 'web') {
    node (Join-Path $PSScriptRoot 'run-graphics-gpu-web.cjs') --perf
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
            Write-Output "M6_PERF_READY $key"
            return
        }
        if ($app.HasExited -or (Select-String -LiteralPath $log -Pattern 'M6_GPU_FAIL|TypeError:|ReferenceError:' -Quiet)) {
            throw "Benchmark failed. See $log"
        }
    }
    throw "Benchmark timed out. See $log"
} finally { if (!$app.HasExited) { Stop-Process -Id $app.Id } }
