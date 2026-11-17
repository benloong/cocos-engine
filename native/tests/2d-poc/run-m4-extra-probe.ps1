param(
    [string]$AppExe = 'C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\proj\Debug\cocos-m1-test.exe',
    [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
$log = Join-Path $env:TEMP 'cc-m4-extra-probe.log'
Remove-Item $log -Force -ErrorAction SilentlyContinue
$proc = Start-Process $AppExe -WorkingDirectory (Split-Path $AppExe) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru

try {
    # The scene schedules this phase 16 seconds after script startup.
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if (Test-Path $log) {
            $graphics = @(Get-Content $log | Select-String -Pattern 'M4_GRAPHICS_STENCIL ')
            $nested = @(Get-Content $log | Select-String -Pattern 'M4_NESTED_MASK ')
            if ($graphics.Count -ge 1 -and $nested.Count -ge 1) { break }
        }
    }

    $graphicsLine = @(Get-Content $log | Select-String -Pattern 'M4_GRAPHICS_STENCIL ')[0]
    $nestedLine = @(Get-Content $log | Select-String -Pattern 'M4_NESTED_MASK ')[0]
    if ($null -eq $graphicsLine) { throw 'GRAPHICS_STENCIL probe missing' }
    if ($null -eq $nestedLine) { throw 'nested Mask probe missing' }

    $graphics = $graphicsLine.Line.Substring($graphicsLine.Line.IndexOf('M4_GRAPHICS_STENCIL ') + 20) | ConvertFrom-Json
    $nested = $nestedLine.Line.Substring($nestedLine.Line.IndexOf('M4_NESTED_MASK ') + 15) | ConvertFrom-Json
    $geometryLine = @(Get-Content $log | Select-String -Pattern 'M4_GRAPHICS_GEOMETRY ')[0]
    if ($null -eq $geometryLine) { throw 'Native Graphics geometry missing' }
    $geometry = $geometryLine.Line.Substring($geometryLine.Line.IndexOf('M4_GRAPHICS_GEOMETRY ') + 21) | ConvertFrom-Json
    if ($geometry.vertices -le 0 -or $geometry.indices -le 0) { throw 'Native Graphics geometry is empty' }
    if ($graphics.red -lt 1500 -or $graphics.red -gt 1700) { throw "GRAPHICS_STENCIL red=$($graphics.red), expected ~1600" }
    if ($nested.red -lt 3400 -or $nested.red -gt 3800) { throw "nested Mask red=$($nested.red), expected ~3600" }

    Write-Host 'M4 extra probe: PASS'
    Write-Host ("  GRAPHICS_STENCIL red={0}" -f $graphics.red)
    Write-Host ("  nested Mask red={0}" -f $nested.red)
} finally {
    if (-not $proc.HasExited) { $proc.Kill() }
}
