param(
    [string]$AppExe = 'C:/Users/wangbenlong/Works/cocos-engine-worktrees/cocos-m1-test/build/windows/proj/Debug/cocos-m1-test.exe',
    [int]$TimeoutSeconds = 600,
    [string]$LogDirectory = (Join-Path $PSScriptRoot 'build/static-atlas-stress-native')
)

$ErrorActionPreference = 'Stop'
$AppExe = (Resolve-Path -LiteralPath $AppExe).Path
$working = Split-Path -Parent $AppExe
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
$run = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfff') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$stdout = Join-Path $LogDirectory "$run.stdout.log"
$stderr = Join-Path $LogDirectory "$run.stderr.log"
$report = Join-Path $LogDirectory "$run.json"
$sha = (Get-FileHash -LiteralPath $AppExe -Algorithm SHA256).Hash.ToLowerInvariant()
$scenarioSha = (Get-FileHash -LiteralPath (Join-Path $working 'Resources/assets/main/index.js') -Algorithm SHA256).Hash.ToLowerInvariant()
$marker = Join-Path $working 'm6-static-atlas-stress'
[System.IO.File]::Open($marker, 'CreateNew', 'Write', 'None').Dispose()
$proc = $null
$samples = [System.Collections.Generic.List[object]]::new()
$samplePrefix = 'M6_STATIC_ATLAS_STRESS_SAMPLE '
$passPrefix = 'M6_STATIC_ATLAS_STRESS_PASS '
$result = $null
$passed = $false

try {
    $proc = Start-Process $AppExe -WorkingDirectory $working -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    while ($timer.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        Start-Sleep -Milliseconds 200
        $proc.Refresh()
        if ($proc.HasExited) { throw "Static atlas stress app exited with $($proc.ExitCode)" }
        $contents = Get-Content -LiteralPath $stdout
        $failure = $contents | Select-String -SimpleMatch 'M6_STATIC_ATLAS_ERROR ' | Select-Object -First 1
        if ($failure) { throw $failure.Line }
        $rows = @($contents | Select-String -SimpleMatch $samplePrefix)
        while ($samples.Count -lt $rows.Count) {
            $line = $rows[$samples.Count].Line
            $sample = $line.Substring($line.IndexOf($samplePrefix) + $samplePrefix.Length) | ConvertFrom-Json -AsHashtable
            $sample.privateBytes = $proc.PrivateMemorySize64
            $sample.workingSetBytes = $proc.WorkingSet64
            $samples.Add($sample)
            Write-Host ("Cycle {0}: {1}/{2} wrappers live, private bytes {3}" -f $sample.cycle, $sample.liveWrappers, $sample.wrappers, $sample.privateBytes)
        }
        $done = $contents | Select-String -SimpleMatch $passPrefix | Select-Object -First 1
        if ($done) {
            $result = $done.Line.Substring($done.Line.IndexOf($passPrefix) + $passPrefix.Length) | ConvertFrom-Json
            break
        }
    }

    if ($null -eq $result -or $result.cycles -ne 1000 -or $result.checkedAssets -ne 5000 -or $result.pixelChecks -ne 22 -or $samples.Count -ne 11) {
        throw "Incomplete static atlas stress result. See $stdout"
    }
    for ($i = 0; $i -lt $samples.Count; $i++) {
        $expectedWrappers = if ($i -eq 0) { 0 } else { 500 }
        if ($samples[$i].cycle -ne $i * 100 -or $samples[$i].wrappers -ne $expectedWrappers -or $samples[$i].privateBytes -le 0 -or
            $samples[$i].liveWrappers -lt 0 -or $samples[$i].liveWrappers -gt $expectedWrappers) {
            throw "Invalid static atlas stress sample $i"
        }
    }
    $passed = $true
    Write-Host 'Windows static atlas: PASS (1000 cycles)'
} finally {
    if ($null -ne $proc -and -not $proc.HasExited) { $proc.Kill(); $null = $proc.WaitForExit(5000) }
    Remove-Item -LiteralPath $marker -Force
    [ordered]@{ passed = $passed; appSha256 = $sha; scenarioSha256 = $scenarioSha; result = $result; samples = @($samples.ToArray()); stdout = $stdout; stderr = $stderr } |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $report -Encoding utf8
    Write-Host "Static atlas stress report: $report"
}
