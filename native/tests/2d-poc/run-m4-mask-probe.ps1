param(
    [string]$AppExe = 'C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\proj\Debug\cocos-m1-test.exe'
)

$ErrorActionPreference = 'Stop'
$log = Join-Path $env:TEMP 'cc-m4-mask-probe.log'
Remove-Item $log -Force -ErrorAction SilentlyContinue
$proc = Start-Process $AppExe -WorkingDirectory (Split-Path $AppExe) `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru

try {
    $deadline = (Get-Date).AddSeconds(15)
    $lines = @()
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if (Test-Path $log) {
            $lines = @(Get-Content $log | Select-String -Pattern 'M4_MASK_PIXEL ')
            if ($lines.Count -ge 2) { break }
        }
    }
    if ($lines.Count -lt 2) { throw "expected 2 M4_MASK_PIXEL lines, got $($lines.Count)" }

    $entries = @()
    foreach ($line in $lines) {
        $json = $line.Line.Substring($line.Line.IndexOf('M4_MASK_PIXEL ') + 14)
        $entries += ($json | ConvertFrom-Json)
    }
    $normal = $entries | Where-Object { -not $_.inverted } | Select-Object -First 1
    $inverted = $entries | Where-Object { $_.inverted } | Select-Object -First 1
    if ($null -eq $normal) { throw 'normal mask capture missing' }
    if ($null -eq $inverted) { throw 'inverted mask capture missing' }
    if ($normal.red -lt 5000 -or $normal.red -gt 8000) { throw "normal mask red=$($normal.red), expected ~6400" }
    if ($inverted.red -le 30000) { throw "inverted mask red=$($inverted.red), expected >30000" }

    Write-Host 'M4 Mask probe: PASS'
    Write-Host ("  normal red={0}, inverted red={1}" -f $normal.red, $inverted.red)
} finally {
    if (-not $proc.HasExited) { $proc.Kill() }
}
