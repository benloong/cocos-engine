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

    $resultLine = ($text -split "`r?`n" | Where-Object { $_ -match 'M2_PIXEL_RESULT' } | Select-Object -Last 1)
    Write-Host $resultLine
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
