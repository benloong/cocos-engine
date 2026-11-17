param(
    [string]$AppExe = 'C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\proj\Debug\cocos-m1-test.exe'
)

$ErrorActionPreference = 'Stop'
$log = Join-Path $env:TEMP 'cc-m5-richtext-probe.log'
Remove-Item $log -Force -ErrorAction SilentlyContinue
$proc = Start-Process $AppExe -WorkingDirectory (Split-Path $AppExe) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru

try {
    $deadline = (Get-Date).AddSeconds(45)
    $lines = @()
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if (Test-Path $log) {
            $lines = @(Get-Content $log | Select-String -Pattern 'M5_RICHTEXT ')
            if ($lines.Count -ge 1) { break }
        }
    }
    if ($lines.Count -lt 1) { throw 'RichText probe missing' }

    $data = $lines[0].Line.Substring($lines[0].Line.IndexOf('M5_RICHTEXT ') + 12) | ConvertFrom-Json
    if ($data.children -lt 1) { throw 'RichText produced no segments' }
    if ($data.labels -lt 1) { throw 'RichText produced no Label segments' }
    if ($data.colored -le 0) { throw 'RichText produced no colored pixels' }
    if ($data.hit -ne $true -or $data.miss -ne $false) { throw 'RichText hit/miss checks failed' }
    if (-not @($data.styles | Where-Object { $_.fontSize -eq 20 }).Count -or
        -not @($data.styles | Where-Object { $_.bold }).Count -or
        -not @($data.styles | Where-Object { $_.italic }).Count -or
        -not @($data.styles | Where-Object { $_.underline }).Count) { throw 'RichText segment styles missing' }

    Write-Host 'M5 RichText probe: PASS'
    Write-Host ("  segments={0}, labels={1}, sprites={2}" -f $data.children, $data.labels, $data.sprites)
    Write-Host ("  content={0}x{1}, colored={2}" -f $data.width, $data.height, $data.colored)
} finally {
    if (-not $proc.HasExited) { $proc.Kill() }
}
