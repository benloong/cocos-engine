param([string]$Exe = (Join-Path $PSScriptRoot 'build/gpu-win/native-2d-m6-gpu.exe'))
$ErrorActionPreference = 'Stop'
$exePath=(Resolve-Path -LiteralPath $Exe).Path
$data=(Resolve-Path (Join-Path $PSScriptRoot 'build/graphics-gpu-project/build/windows/data')).Path
$resources=Join-Path (Split-Path -Parent $exePath) 'Resources'
& robocopy $data $resources /E /NFL /NDL /NJH /NJS /NP | Out-Null
if($LASTEXITCODE -gt 7) { throw 'Resource copy failed' }
$log=Join-Path $PSScriptRoot 'build/graphics-gpu-native.log'
$err=Join-Path $PSScriptRoot 'build/graphics-gpu-native.err.log'
$manifest=Join-Path $PSScriptRoot 'build/graphics-gpu-native/manifest.json'
$started=[DateTime]::UtcNow
$process=Start-Process -FilePath $exePath -WorkingDirectory (Split-Path -Parent $exePath) -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err -PassThru
try {
    $deadline=$started.AddSeconds(45)
    while([DateTime]::UtcNow -lt $deadline) {
        if((Test-Path -LiteralPath $manifest) -and (Get-Item -LiteralPath $manifest).LastWriteTimeUtc -gt $started) {
            $result=Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
            if($result.backend -ne 'native' -or $result.captures.Count -ne 58 -or $result.hits.Count -ne 19 -or $result.roots.Count -ne 11) { throw 'Invalid native capture manifest' }
            Write-Output "M6_GPU_NATIVE_READY $($result.captures.Count)"
            exit 0
        }
        if($process.HasExited) { throw "Native GPU app exited: $($process.ExitCode); see $log and $err" }
        if((Test-Path -LiteralPath $log) -and (Select-String -LiteralPath $log -Pattern 'M6_GPU_FAIL' -Quiet)) { throw "Native GPU capture failed: $log" }
        Start-Sleep -Milliseconds 250
    }
    throw "Native capture timeout: $log"
} finally { if(-not $process.HasExited) { Stop-Process -Id $process.Id } }
