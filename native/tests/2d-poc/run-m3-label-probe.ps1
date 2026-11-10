param(
    [string]$AppExe = 'C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\proj\Debug\cocos-m1-test.exe'
)

$ErrorActionPreference = 'Stop'
$log = Join-Path $env:TEMP 'cc-m3-label-probe.log'
Remove-Item $log -Force -ErrorAction SilentlyContinue
$proc = Start-Process $AppExe -WorkingDirectory (Split-Path $AppExe) `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru

try {
    $deadline = (Get-Date).AddSeconds(20)
    $lines = @()
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if (Test-Path $log) {
            $lines = @(Get-Content $log | Select-String -Pattern 'M3_SHELL_LABEL ')
            if ($lines.Count -ge 3) { break }
        }
    }
    if ($lines.Count -lt 3) {
        throw "expected 3 M3_SHELL_LABEL lines, got $($lines.Count)"
    }
    $entries = foreach ($line in $lines) {
        $json = $line.Line.Substring($line.Line.IndexOf('M3_SHELL_LABEL ') + 15)
        $json | ConvertFrom-Json
    }
    $byName = @{}
    foreach ($entry in $entries) { $byName[$entry.name] = $entry }

    foreach ($name in @('english', 'cjk')) {
        if (-not $byName.ContainsKey($name)) { throw "missing $name" }
        if ($byName[$name].lines -ne 1) { throw "$name expected 1 line" }
        if ($byName[$name].opaque -le 0) { throw "$name has no opaque text pixels" }
    }
    if (-not $byName.ContainsKey('wrap')) { throw 'missing wrap' }
    if ($byName['wrap'].lines -lt 2) { throw 'wrap expected multiple lines' }
    if ($byName['wrap'].opaque -le 0) { throw 'wrap has no opaque text pixels' }

    Write-Host 'M3 Label probe: PASS'
    $byName.Values | ForEach-Object {
        Write-Host ("  {0}: {1}x{2}, lines={3}, opaque={4}" -f $_.name, $_.textureWidth, $_.textureHeight, $_.lines, $_.opaque)
    }
} finally {
    if (-not $proc.HasExited) { $proc.Kill() }
}
