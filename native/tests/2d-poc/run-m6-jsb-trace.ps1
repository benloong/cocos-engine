param([string]$BuildDir = (Join-Path $PSScriptRoot 'build/gpu-win-trace'))
$ErrorActionPreference = 'Stop'
$app = (Resolve-Path (Join-Path $BuildDir 'native-2d-m6-gpu.exe')).Path
$data = (Resolve-Path (Join-Path $PSScriptRoot 'build/graphics-gpu-project/build/windows/data')).Path
$resources = Join-Path $BuildDir 'Resources'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$font = (Join-Path $repo 'tests/fixtures/Thonburi.ttf').Replace('\','/') | ConvertTo-Json -Compress
$fixture = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'jsb-trace-fixture.js')
$entry = Get-Content -Raw -LiteralPath (Join-Path $data 'main.js')
$hook = 'return application.init(cc);'
if ($entry.Split($hook, [StringSplitOptions]::None).Count -ne 2) { throw 'Expected exactly one application.init hook' }
& robocopy $data $resources /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -gt 7) { throw 'Could not copy the acceptance scene' }
$writable = New-Item -ItemType Directory -Force -Path (Join-Path $BuildDir 'trace-writable')
$writablePath = ($writable.FullName.Replace('\','/') + '/') | ConvertTo-Json -Compress
$entry = $entry.Replace($hook, "jsb.fileUtils.setWritablePath($writablePath);`n$fixture`ninstallM6JsbTrace(cc, $font);`n$hook")
[IO.File]::WriteAllText((Join-Path $resources 'main.js'), $entry)
$out = Join-Path $BuildDir 'trace.log'
$err = Join-Path $BuildDir 'trace.err'
$proc = Start-Process -FilePath $app -WorkingDirectory $BuildDir -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
try {
    $deadline = [DateTime]::UtcNow.AddMinutes(4)
    do {
        Start-Sleep -Milliseconds 350
        $log = Get-Content -Raw -LiteralPath $out
        if (!$log) { $log = '' }
        if ($log.Contains('M6_TRACE_FAIL') -or $log.Contains('[FATAL ERROR]') -or $log.Contains('shared the same TypeID()') -or $proc.HasExited) { throw "Trace application failed; see $out and $err" }
        if ($log.Contains('M6_TRACE_DONE ')) {
            node (Join-Path $PSScriptRoot 'summarize-jsb-trace.cjs') $out (Join-Path $BuildDir 'trace.json')
            if ($LASTEXITCODE) { throw 'Trace verification failed' }
            return
        }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Trace did not complete; see $out"
} finally {
    if (!$proc.HasExited) { Stop-Process -Id $proc.Id }
}
