param(
    [string]$NativeExe = (Join-Path $PSScriptRoot 'native/out/cc2d_native_poc.exe'),
    [string]$Label = 'test'
)
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot ('build/log-visibility/' + $Label + '-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $root | Out-Null
$ready = Join-Path $root 'ready'
$release = Join-Path $root 'release'
$stdout = Join-Path $root 'stdout.log'
$stderr = Join-Path $root 'stderr.log'
$watch = [System.Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process $NativeExe -ArgumentList @('--log-visibility-probe', "`"$ready`"", "`"$release`"") `
    -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
$passed = $false
$visible = $false
$alive = $false
$failure = $null
try {
    while (-not (Test-Path -LiteralPath $ready) -and $watch.Elapsed.TotalSeconds -lt 5) {
        if ($proc.HasExited) { throw "Log child exited before ready: $($proc.ExitCode)" }
        Start-Sleep -Milliseconds 20
    }
    if (-not (Test-Path -LiteralPath $ready)) { throw 'Log child did not acknowledge completed log calls' }
    $alive = -not $proc.HasExited
    if (-not $alive) { throw 'Log child must still be waiting for release' }
    $before = [string](Get-Content -LiteralPath $stdout -Raw)
    $visible = (-not [string]::IsNullOrEmpty($before)) -and $before.Contains('M6_LOG_VISIBLE kernel') -and $before.Contains('M6_LOG_VISIBLE script')
    if (-not $visible) { throw 'Completed Win32 log messages are buffered until later output or process exit' }
    $passed = $true
} catch {
    $failure = $_.Exception.Message
    throw
} finally {
    Set-Content -LiteralPath $release -Value 'release' -Encoding ascii
    if (-not $proc.WaitForExit(5000)) { $proc.Kill(); $null = $proc.WaitForExit(5000); $passed = $false }
    $after = [string](Get-Content -LiteralPath $stdout -Raw)
    [ordered]@{ passed = $passed; failure = $failure; childAliveBeforeRelease = $alive; visibleBeforeRelease = $visible;
        visibleAfterExit = ((-not [string]::IsNullOrEmpty($after)) -and $after.Contains('M6_LOG_VISIBLE kernel') -and $after.Contains('M6_LOG_VISIBLE script'));
        exitCode = $proc.ExitCode; elapsedSeconds = $watch.Elapsed.TotalSeconds; stdout = $stdout; stderr = $stderr } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'result.json') -Encoding utf8
    Write-Host "Log visibility report: $root/result.json"
}
if (-not $passed -or $proc.ExitCode -ne 0) { throw 'Log visibility child failed' }
Write-Host 'Win32 redirected log visibility: PASS'
