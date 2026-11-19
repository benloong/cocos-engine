param(
    [string]$AppExe = 'C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\proj\Debug\cocos-m1-test.exe'
)

$ErrorActionPreference = 'Stop'
$log = Join-Path $env:TEMP 'cc-m3-label-probe.log'
Remove-Item $log -Force -ErrorAction SilentlyContinue
$proc = Start-Process $AppExe -WorkingDirectory (Split-Path $AppExe) `
    -WindowStyle Hidden `
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
                if ($pixelProbe.Count -ge 7) { break }
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
    if ($bitmap.textureWidth -le 0 -or -not $bitmap.samplesFontAtlas) { throw 'BMFont atlas path produced no pixels' }
    # Kerning GPU pixels are compared in the fixed M5 BitmapGpuProbe matrix.
    # This fixture now observes actual scaled layout and submissions, not a CPU texture-width proxy.
    if ($bitmap.width -ne 80 -or $bitmap.height -ne 20 -or $bitmap.actualFontSize -ne 16 -or
        $bitmap.glyphs -ne 4 -or $bitmap.vertices -ne 16 -or $bitmap.indices -ne 24) { throw 'BMFont layout or glyph submission mismatch' }

    $charAsciiLines = @(Get-Content $log | Select-String -Pattern 'M3_CHAR_ASCII ')
    if ($charAsciiLines.Count -lt 1) { throw 'ASCII CHAR Label missing' }
    $charAscii = $charAsciiLines[0].Line.Substring($charAsciiLines[0].Line.IndexOf('M3_CHAR_ASCII ') + 14) | ConvertFrom-Json
    if ($charAscii.textureWidth -le 0) { throw 'ASCII CHAR Label produced no pixels' }

    $charLines = @(Get-Content $log | Select-String -Pattern 'M3_CHAR_LABEL ')
    if ($charLines.Count -lt 1) { throw 'CHAR Label missing' }
    $charLabel = $charLines[0].Line.Substring($charLines[0].Line.IndexOf('M3_CHAR_LABEL ') + 14) | ConvertFrom-Json
    if ($charLabel.textureWidth -le 0) { throw 'CHAR Label produced no pixels' }

    $bitmapAtlasLines = @(Get-Content $log | Select-String -Pattern 'M3_BITMAP_ATLAS ')
    if ($bitmapAtlasLines.Count -lt 1) { throw 'BITMAP atlas label missing' }
    $bitmapAtlas = $bitmapAtlasLines[0].Line.Substring($bitmapAtlasLines[0].Line.IndexOf('M3_BITMAP_ATLAS ') + 16) | ConvertFrom-Json
    if ($bitmapAtlas.a.id -ne $bitmapAtlas.b.id) { throw 'BITMAP labels do not share an atlas texture' }
    if ($bitmapAtlas.a.w -le 0 -or $bitmapAtlas.b.w -le 0 -or $bitmapAtlas.a.x -eq $bitmapAtlas.b.x) { throw 'BITMAP atlas regions invalid' }

    $realLines = @(Get-Content $log | Select-String -Pattern 'M3_REAL_BMFONT ')
    if ($realLines.Count -lt 1) { throw 'real BitmapFont label missing' }
    $realFont = $realLines[0].Line.Substring($realLines[0].Line.IndexOf('M3_REAL_BMFONT ') + 15) | ConvertFrom-Json
    if ($realFont.textureWidth -le 0 -or -not $realFont.samplesFontAtlas -or $realFont.vertices -le 0) { throw 'real BitmapFont produced no pixels' }

    $pixelLines = @(Get-Content $log | Select-String -Pattern 'M3_LABEL_PIXEL ')
    $pixels = @{}
    foreach ($line in $pixelLines) {
        $obj = $line.Line.Substring($line.Line.IndexOf('M3_LABEL_PIXEL ') + 15) | ConvertFrom-Json
        $pixels[$obj.name] = $obj
    }
    if (-not $pixels.ContainsKey('M3Label-english') -or $pixels['M3Label-english'].colored -le 0) { throw 'English GPU pixels missing' }
    if (-not $pixels.ContainsKey('M3Label-wrap') -or $pixels['M3Label-wrap'].colored -le 0) { throw 'wrap GPU pixels missing' }
    if (-not $pixels.ContainsKey('M3CharAscii') -or $pixels['M3CharAscii'].colored -le 0) { throw 'CHAR ASCII GPU pixels missing' }
    foreach ($name in 'M3BitmapLabel','M3RealBitmapLabel') {
        if (-not $pixels.ContainsKey($name) -or $pixels[$name].colored -le 0) { throw "$name has no visible GPU pixels" }
    }
    $byName = @{}
    foreach ($entry in $entries) { $byName[$entry.name] = $entry }

    foreach ($name in @('english', 'cjk')) {
        if (-not $byName.ContainsKey($name)) { throw "missing $name" }
        if ($byName[$name].lines -ne 1) { throw "$name expected 1 line" }
        if ($pixels["M3Label-$name"].colored -le 0) { throw "$name has no visible text pixels" }
    }
    if (-not $byName.ContainsKey('wrap')) { throw 'missing wrap' }
    if ($byName['wrap'].lines -lt 2) { throw 'wrap expected multiple lines' }

    Write-Host 'M3 Label probe: PASS'
    Write-Host ("  GPU english colored={0}, wrap colored={1}, cjk colored={2}" -f $pixels['M3Label-english'].colored, $pixels['M3Label-wrap'].colored, $pixels['M3Label-cjk'].colored)
    Write-Host ("  BMFont {0}x{1}, samples font atlas={2}" -f $bitmap.textureWidth, $bitmap.textureHeight, $bitmap.samplesFontAtlas)
    Write-Host ("  Real BMFont {0}x{1}, samples font atlas={2}" -f $realFont.textureWidth, $realFont.textureHeight, $realFont.samplesFontAtlas)
    Write-Host ("  CHAR Label {0}x{1}, GPU colored={2}" -f $charLabel.textureWidth, $charLabel.textureHeight, $pixels['M3Label-cjk'].colored)
    Write-Host ("  CHAR ASCII {0}x{1}, GPU colored={2}" -f $charAscii.textureWidth, $charAscii.textureHeight, $pixels['M3CharAscii'].colored)
    Write-Host ("  BITMAP atlas id={0}, a.x={1}, b.x={2}" -f $bitmapAtlas.a.id, $bitmapAtlas.a.x, $bitmapAtlas.b.x)
    $byName.Values | ForEach-Object {
        Write-Host ("  {0}: {1}x{2}, lines={3}" -f $_.name, $_.textureWidth, $_.textureHeight, $_.lines)
    }
} finally {
    if (-not $proc.HasExited) { $proc.Kill() }
}
