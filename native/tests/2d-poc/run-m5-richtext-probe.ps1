param(
    [string]$AppExe = 'C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\proj\Debug\cocos-m1-test.exe',
    [int]$TimeoutSeconds = 45,
    [string]$LogDirectory = (Join-Path $PSScriptRoot 'build/m5-probe-runs'),
    [ValidateSet('native','js')][string]$Implementation = 'native',
    [switch]$RequireNormalExit
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
$run = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfff') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$log = Join-Path $LogDirectory "$run.stdout.log"
$reportPath = Join-Path $LogDirectory "$run.json"
$binarySha = (Get-FileHash -LiteralPath $AppExe -Algorithm SHA256).Hash.ToLowerInvariant()
$started = (Get-Date).ToUniversalTime()
$watch = [System.Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process $AppExe -WorkingDirectory (Split-Path $AppExe) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru
# Retain the native handle so early-exit diagnostics keep a usable ExitCode.
$nativeProcessHandle = $proc.Handle
$passed = $false
$failure = $null
$samples = [System.Collections.Generic.List[object]]::new()
$exitBeforeCleanup = $null
$aliveAtResult = $false
try {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lines = @()
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        $proc.Refresh()
        $exited = $proc.HasExited
        $cpu = $null
        try { $cpu = $proc.TotalProcessorTime.TotalSeconds } catch {}
        $samples.Add([ordered]@{ elapsed = $watch.Elapsed.TotalSeconds; wallElapsed = ((Get-Date).ToUniversalTime() - $started).TotalSeconds; exited = $exited; cpu = $cpu })
        if (Test-Path -LiteralPath $log) {
            $contents = Get-Content -LiteralPath $log
            if (@($contents | Select-String -Pattern 'M5_RICHTEXT_ERROR ').Count) { throw 'Bitmap/RichText fixture reported an error; see retained stdout' }
            $lines = @($contents | Select-String -Pattern 'M5_RICHTEXT ')
            if ($lines.Count -ge 1) { break }
        }
        if ($exited) { throw "RichText app exited before probe marker (exit=$($proc.ExitCode)); stdout=$log; stderr=$log.err" }
    }
    if ($lines.Count -lt 1) { throw "RichText probe missing after $TimeoutSeconds seconds; stdout=$log" }

    $bitmapLine = @(Get-Content -LiteralPath $log | Select-String -Pattern 'M6_BITMAP_GPU_READY ')
    if ($bitmapLine.Count -ne 1) { throw 'Bitmap GPU completion missing' }
    $bitmap = $bitmapLine[0].Line.Substring($bitmapLine[0].Line.IndexOf('M6_BITMAP_GPU_READY ') + 20) | ConvertFrom-Json
    if ($bitmap.captures -ne 12 -or $bitmap.native -ne $true -or $bitmap.checks.Count -ne 4 -or
        @($bitmap.checks | Where-Object { -not $_.samplesSourceUpdates }).Count) { throw 'Bitmap GPU sampling checks failed' }
    $bitmapCaptures = @(Get-Content -LiteralPath $log | Select-String -Pattern 'M6_BITMAP_CAPTURE ' | ForEach-Object {
        ($_.Line.Substring($_.Line.IndexOf('M6_BITMAP_CAPTURE ') + 18) | ConvertFrom-Json).name
    })
    foreach ($kind in @('bitmap', 'atlas')) {
        foreach ($rotation in @('flat', 'rotated')) {
            foreach ($stage in @('source', 'disabled', 'reset')) {
                if (@($bitmapCaptures | Where-Object { $_ -eq "$kind-$rotation-$stage" }).Count -ne 1) {
                    throw "Bitmap source fallback capture missing or duplicated: $kind-$rotation-$stage"
                }
            }
        }
    }
    $layoutMetrics = @(Get-Content -LiteralPath $log | Select-String -Pattern 'M6_BITMAP_LAYOUT ' | ForEach-Object {
        $_.Line.Substring($_.Line.IndexOf('M6_BITMAP_LAYOUT ') + 17) | ConvertFrom-Json
    })
    if ($bitmap.layoutCaptures -ne 80 -or $layoutMetrics.Count -ne 80 -or @($layoutMetrics.name | Select-Object -Unique).Count -ne 80) { throw 'Bitmap layout captures missing' }
    $largeLine = @(Get-Content -LiteralPath $log | Select-String -Pattern 'M6_BITMAP_LARGE ')
    if ($largeLine.Count -ne 1) { throw 'Large bitmap GPU completion missing' }
    $large = $largeLine[0].Line.Substring($largeLine[0].Line.IndexOf('M6_BITMAP_LARGE ') + 16) | ConvertFrom-Json
    if ($large.layoutWidth -ne 1119996 -or -not $large.tailVisible -or -not $large.cleared) { throw 'Large bitmap GPU checks failed' }
    $data = $lines[0].Line.Substring($lines[0].Line.IndexOf('M5_RICHTEXT ') + 12) | ConvertFrom-Json
    if (($data.clicks -join ',') -cne 'first,second,second') { throw 'RichText click dispatch or teardown failed' }
    if ($data.children -lt 1) { throw 'RichText produced no segments' }
    if ($data.labels -lt 1) { throw 'RichText produced no Label segments' }
    if ($data.colored -le 0) { throw 'RichText produced no colored pixels' }
    if ($data.hit -ne $true -or $data.miss -ne $false) { throw 'RichText hit/miss checks failed' }
    # System Arial, 40 px, synthetic italic. M5 accepted a 9.748 px GDI width difference.
    if ($data.native) {
        if ($data.labels -ne 9 -or $data.sprites -ne 1 -or $data.children -ne 10) { throw 'Unexpected native RichText segment layout' }
        $italic, $space, $underline = $data.segments[6..8]
        $italicWidth = $space.x - $italic.x
        if (@($italic, $space, $underline | Where-Object name -CNE 'RICHTEXT_CHILD').Count) { throw 'Missing native text segment' }
    } else {
        if (-not @($data.styles | Where-Object { $_.fontSize -eq 20 }).Count -or
            -not @($data.styles | Where-Object { $_.bold }).Count -or
            -not @($data.styles | Where-Object { $_.italic }).Count -or
            -not @($data.styles | Where-Object { $_.underline }).Count) { throw 'RichText segment styles missing' }
        $matches = @($data.segments | Where-Object text -CEQ 'Italic')
        if ($matches.Count -ne 1 -or $null -eq $matches[0].w) { throw 'Missing Italic width' }
        $italic = $matches[0]
        $italicWidth = $italic.w
        $italicIndex = [array]::IndexOf($data.segments, $italic)
        $space, $underline = $data.segments[($italicIndex + 1)..($italicIndex + 2)]
        if ($space.text -cne ' ' -or $underline.text -cne 'Underline') { throw 'Missing space or underlined text' }
    }
    if ([Math]::Abs($italicWidth - 90.748) -gt 9.749) {
        throw 'M5 system Arial Italic segment exceeds its Windows layout tolerance'
    }
    Write-Host ("  system Arial Italic width={0}" -f $italicWidth)
    if ($space.y -ne $italic.y -or $underline.y -ge $space.y) {
        throw 'The trailing space must fit after Italic before Underline wraps'
    }
    Write-Host ("  segments={0}, labels={1}, sprites={2}" -f $data.children, $data.labels, $data.sprites)
    Write-Host ("  content={0}x{1}, colored={2}" -f $data.width, $data.height, $data.colored)
    if (!$data.queryMatches -or $data.native -ne ($Implementation -eq 'native')) {
        throw "Unexpected RichText implementation or segment query result for $Implementation"
    }
    if ($Implementation -eq 'native' -and ($data.jsLabelComponents -ne 0 -or $data.jsSpriteComponents -ne 0)) {
        throw 'Native segment nodes exposed unexpected script renderer components'
    }
    if ($Implementation -eq 'js' -and ($data.jsLabelComponents -ne $data.labels -or $data.jsSpriteComponents -ne $data.sprites)) {
        throw 'JS RichText segment queries did not return their renderers'
    }
    $captureDirectory = Join-Path (Split-Path -Parent (Resolve-Path -LiteralPath $AppExe)) 'm6-bitmap-captures'
    $layoutMetrics | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $captureDirectory 'layout-metrics.json') -Encoding utf8
    if ($RequireNormalExit) {
        $remaining = [Math]::Max(0, [int]($deadline - (Get-Date)).TotalMilliseconds)
        if (-not $proc.WaitForExit($remaining)) { throw 'RichText app did not exit after completion' }
        if ($proc.ExitCode -ne 0) { throw "RichText app exited with code $($proc.ExitCode)" }
        Write-Host 'M5 RichText app exit: 0'
    }
    $passed = $true
    Write-Host 'M5 RichText probe: PASS'
} catch {
    $failure = $_.Exception.Message
    throw
} finally {
    $proc.Refresh()
    $aliveAtResult = -not $proc.HasExited
    if (-not $aliveAtResult) { $exitBeforeCleanup = $proc.ExitCode }
    $elapsed = $watch.Elapsed.TotalSeconds
    if ($aliveAtResult) { $proc.Kill(); $null = $proc.WaitForExit(5000) }
    $timeline = @()
    if (Test-Path -LiteralPath $log) {
        $timeline = @(Get-Content -LiteralPath $log | Select-String -Pattern 'M1_TEST_NODE|M4_MASK_PIXEL|M4_GRAPHICS |M4_NESTED_MASK|M6_BITMAP|M5_' | ForEach-Object { $_.Line })
    }
    [ordered]@{ run = $run; app = $AppExe; appSha256 = $binarySha; processId = $proc.Id; startedUtc = $started.ToString('o'); timeoutSeconds = $TimeoutSeconds;
        passed = $passed; failure = $failure; elapsedSeconds = $elapsed; aliveBeforeCleanup = $aliveAtResult;
        exitBeforeCleanup = $exitBeforeCleanup; killedForCleanup = $aliveAtResult; stdout = $log; stderr = "$log.err";
        samples = @($samples.ToArray()); timeline = $timeline } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding utf8
    Write-Host "M5 run report: $reportPath"
}
