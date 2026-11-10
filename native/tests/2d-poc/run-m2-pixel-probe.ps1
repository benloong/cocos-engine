param(
    [string]$Exe = $env:CC_M2_APP_EXE,
    [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Exe) -or -not (Test-Path $Exe)) {
    throw "M2 pixel probe app not found. Pass -Exe <cocos-m1-test.exe> or set CC_M2_APP_EXE."
}

$log = Join-Path $env:TEMP "m2-pixel-probe-$PID.log"
$err = Join-Path $env:TEMP "m2-pixel-probe-$PID.err.log"
Remove-Item $log, $err -Force -ErrorAction SilentlyContinue

$process = Start-Process -FilePath $Exe `
    -WorkingDirectory (Split-Path $Exe) `
    -RedirectStandardOutput $log `
    -RedirectStandardError $err `
    -PassThru

try {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $text = ''
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if (Test-Path $log) {
            $text = Get-Content $log -Raw
            if ($text -match 'M2_PIXEL_PASS|M2_PIXEL_FAIL') {
                break
            }
        }
    }

    if ($text -notmatch 'M2_PIXEL_PASS|M2_PIXEL_FAIL') {
        throw "M2 pixel probe timed out. Log: $log"
    }

    $materialLine = ($text -split "`r?`n" | Where-Object { $_ -match 'M2_MATERIAL_INSTANCE' } | Select-Object -Last 1)
    if (-not $materialLine -or $materialLine -notmatch '"hasInstance":true' -or $materialLine -notmatch '"distinct":true') {
        throw "M2 material instance probe did not report a distinct native instance: $materialLine"
    }

    $resultLine = ($text -split "`r?`n" | Where-Object { $_ -match 'M2_PIXEL_RESULT' } | Select-Object -Last 1)
    Write-Host $resultLine
    $jsonText = ($resultLine -replace '^.*M2_PIXEL_RESULT\s*', '')
    $result = $jsonText | ConvertFrom-Json
    $golden = Get-Content (Join-Path $PSScriptRoot 'm2-pixel-golden.json') -Raw | ConvertFrom-Json
    foreach ($item in $result.results) {
        if ($item.red -ne $golden.expectedRed -or $item.maxR -ne $golden.maxR) {
            throw "M2 pixel golden mismatch for $($item.mode): red=$($item.red) maxR=$($item.maxR)"
        }
        if (($item.center -join ',') -ne ($golden.center -join ',')) {
            throw "M2 pixel golden center mismatch for $($item.mode): $($item.center -join ',')"
        }
    }
    if ($text -match 'M2_PIXEL_PASS') {
        Write-Host 'M2 pixel probe: PASS'
        exit 0
    }

    Write-Host 'M2 pixel probe: FAIL'
    exit 1
} finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
}
