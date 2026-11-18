param(
    [string]$AppExe = 'C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\proj\Debug\cocos-m1-test.exe',
    [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
$log = Join-Path $env:TEMP 'cc-m4-mask-probe.log'
Remove-Item $log -Force -ErrorAction SilentlyContinue
$captureRoot = Join-Path (Split-Path $AppExe) 'm6-atlas-captures'
$captureFiles = @()
foreach ($consumer in @('sprite', 'mask')) { foreach ($sampling in @('repeat', 'clamp')) { foreach ($stage in @('source', 'packed', 'restored')) {
    $file = Join-Path $captureRoot "$consumer-$sampling-$stage.rgba"
    $captureFiles += $file
    Remove-Item -LiteralPath $file -ErrorAction SilentlyContinue
} } }
$proc = Start-Process $AppExe -WorkingDirectory (Split-Path $AppExe) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru

try {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lines = @()
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if (Test-Path $log) {
            $lines = @(Get-Content $log | Select-String -Pattern 'M4_MASK_PIXEL ')
            if ($lines.Count -ge 2) {
                $extra = @(Get-Content $log | Select-String -Pattern 'M4_ELLIPSE_PIXEL |M4_SPRITE_PIXEL ')
                $graphicsProbe = @(Get-Content $log | Select-String -Pattern 'M4_GRAPHICS ')
                if ($extra.Count -ge 2 -and $graphicsProbe.Count -ge 1) { break }
            }
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

    $ellipseLine = @(Get-Content $log | Select-String -Pattern 'M4_ELLIPSE_PIXEL ')[0]
    $spriteLine = @(Get-Content $log | Select-String -Pattern 'M4_SPRITE_PIXEL ')[0]
    if ($null -eq $ellipseLine -or $null -eq $spriteLine) { throw 'ellipse/sprite mask capture missing' }
    $ellipse = $ellipseLine.Line.Substring($ellipseLine.Line.IndexOf('M4_ELLIPSE_PIXEL ') + 17) | ConvertFrom-Json
    $sprite = $spriteLine.Line.Substring($spriteLine.Line.IndexOf('M4_SPRITE_PIXEL ') + 16) | ConvertFrom-Json
    if ($ellipse.red -lt 4500 -or $ellipse.red -gt 5600) { throw "ellipse red=$($ellipse.red), expected ~5140" }
    if ($sprite.red -lt 2800 -or $sprite.red -gt 3800) { throw "sprite red=$($sprite.red), expected ~3360" }

    $graphicsLines = @(Get-Content $log | Select-String -Pattern 'M4_GRAPHICS ')
    if ($graphicsLines.Count -lt 1) { throw 'Graphics raster capture missing' }
    $graphics = $graphicsLines[0].Line.Substring($graphicsLines[0].Line.IndexOf('M4_GRAPHICS ') + 12) | ConvertFrom-Json
    if ($graphics.opaque -lt 6000 -or $graphics.opaque -gt 7000) { throw "Graphics opaque=$($graphics.opaque), expected ~6400" }

    $atlasEntries = @(Get-Content $log | Select-String -Pattern 'M6_DYNAMIC_ATLAS ' | ForEach-Object {
        $_.Line.Substring($_.Line.IndexOf('M6_DYNAMIC_ATLAS ') + 17) | ConvertFrom-Json
    })
    foreach ($consumer in @('Sprite', 'Mask')) {
        foreach ($sampling in @('repeat', 'clamp')) {
            $entry = @($atlasEntries | Where-Object { $_.consumer -eq $consumer -and $_.sampling -eq $sampling })
            if ($entry.Count -ne 1 -or -not $entry[0].state -or -not $entry[0].restored) { throw "Dynamic atlas $consumer/$sampling state/restore mismatch" }
            if ($sampling -eq 'clamp' -and -not $entry[0].equal) { throw "Dynamic atlas $consumer clamp framebuffer mismatch" }
        }
    }

    if (-not (Select-String -LiteralPath $log -SimpleMatch "M6_ATLAS_FALLBACK_PASS" -Quiet)) { throw "Dynamic atlas fallback probe missing" }
    foreach ($file in $captureFiles) {
        if (-not (Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -ne 262144) { throw "Missing/invalid atlas capture: $file" }
    }
    Write-Host 'M4 Mask probe: PASS'
    Write-Host ("  normal red={0}, inverted red={1}" -f $normal.red, $inverted.red)
    Write-Host ("  ellipse red={0}, sprite red={1}" -f $ellipse.red, $sprite.red)
    Write-Host ("  Graphics opaque={0}" -f $graphics.opaque)
    Write-Host '  Dynamic atlas Sprite/Mask repeat+clamp state and restore passed; clamp framebuffer identical'
} finally {
    if (-not $proc.HasExited) { $proc.Kill() }
}
