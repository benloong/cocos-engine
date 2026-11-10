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
            if ($lines.Count -ge 3) {
                $pixelProbe = @(Get-Content $log | Select-String -Pattern 'M3_LABEL_PIXEL ')
                if ($pixelProbe.Count -ge 3) { break }
            }
        }
    }
    if ($lines.Count -lt 3) {
        throw "expected 3 M3_SHELL_LABEL lines, got $($lines.Count)"
    }
    $measureLines = @(Get-Content $log | Select-String -Pattern 'M3_LABEL_MEASURE ')
    $entries = foreach ($line in $lines) {
        $json = $line.Line.Substring($line.Line.IndexOf('M3_SHELL_LABEL ') + 15)
        $json | ConvertFrom-Json
    }
    $measure = @{}
    foreach ($line in $measureLines) {
        $obj = $line.Line.Substring($line.Line.IndexOf('M3_LABEL_MEASURE ') + 17) | ConvertFrom-Json
        $measure[$obj.name] = $obj
    }
    $expected = @{ english = @(240, 50.4); cjk = @(240, 50.4); wrap = @(220, 97.8) }
    foreach ($name in $expected.Keys) {
        if (-not $measure.ContainsKey($name)) { throw "missing measurement $name" }
        if ([math]::Abs($measure[$name].width - $expected[$name][0]) -gt 0.5) { throw "$name width parity failed" }
        if ([math]::Abs($measure[$name].height - $expected[$name][1]) -gt 0.5) { throw "$name height parity failed" }
    }
    $bitmapLines = @(Get-Content $log | Select-String -Pattern 'M3_BITMAP_LABEL ')
    if ($bitmapLines.Count -lt 1) { throw 'BMFont label missing' }
    $bitmap = $bitmapLines[0].Line.Substring($bitmapLines[0].Line.IndexOf('M3_BITMAP_LABEL ') + 16) | ConvertFrom-Json
    if ($bitmap.textureWidth -le 0 -or $bitmap.opaque -le 0) { throw 'BMFont atlas path produced no pixels' }
    if ($bitmap.textureWidth -ge 66) { throw 'BMFont kerning was not applied' }

    $realLines = @(Get-Content $log | Select-String -Pattern 'M3_REAL_BMFONT ')
    if ($realLines.Count -lt 1) { throw 'real BitmapFont label missing' }
    $realFont = $realLines[0].Line.Substring($realLines[0].Line.IndexOf('M3_REAL_BMFONT ') + 15) | ConvertFrom-Json
    if ($realFont.textureWidth -le 0 -or $realFont.opaque -le 0) { throw 'real BitmapFont produced no pixels' }

    $pixelLines = @(Get-Content $log | Select-String -Pattern 'M3_LABEL_PIXEL ')
    $pixels = @{}
    foreach ($line in $pixelLines) {
        $obj = $line.Line.Substring($line.Line.IndexOf('M3_LABEL_PIXEL ') + 15) | ConvertFrom-Json
        $pixels[$obj.name] = $obj
    }
    if (-not $pixels.ContainsKey('M3Label-english') -or $pixels['M3Label-english'].colored -le 0) { throw 'English GPU pixels missing' }
    if (-not $pixels.ContainsKey('M3Label-wrap') -or $pixels['M3Label-wrap'].colored -le 0) { throw 'wrap GPU pixels missing' }
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
    Write-Host ("  GPU english colored={0}, wrap colored={1}" -f $pixels['M3Label-english'].colored, $pixels['M3Label-wrap'].colored)
    Write-Host ("  BMFont {0}x{1}, opaque={2}" -f $bitmap.textureWidth, $bitmap.textureHeight, $bitmap.opaque)
    Write-Host ("  Real BMFont {0}x{1}, opaque={2}" -f $realFont.textureWidth, $realFont.textureHeight, $realFont.opaque)
    $byName.Values | ForEach-Object {
        Write-Host ("  {0}: {1}x{2}, lines={3}, opaque={4}" -f $_.name, $_.textureWidth, $_.textureHeight, $_.lines, $_.opaque)
    }
} finally {
    if (-not $proc.HasExited) { $proc.Kill() }
}
