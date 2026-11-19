param([string]$Exe = (Join-Path $PSScriptRoot 'build/gpu-win/native-2d-m6-gpu.exe'), [ValidateSet('graphics','richtext')][string]$Mode = 'graphics', [string]$FontHttpOrigin = '',
    [ValidateSet('native','js')][string]$OpacityImplementation,
    [ValidateSet('native','js')][string]$RootImplementation,
    [ValidateSet('native','js')][string]$RichTextImplementation)
$ErrorActionPreference = 'Stop'
$exePath=(Resolve-Path -LiteralPath $Exe).Path
$data=(Resolve-Path (Join-Path $PSScriptRoot "build/$Mode-gpu-project/build/windows/data")).Path
$resources=Join-Path (Split-Path -Parent $exePath) 'Resources'
& robocopy $data $resources /E /NFL /NDL /NJH /NJS /NP | Out-Null
if($LASTEXITCODE -gt 7) { throw 'Resource copy failed' }
if ($OpacityImplementation -or $RootImplementation) {
    if ($Mode -ne 'graphics' -or ($OpacityImplementation -and $RootImplementation)) { throw 'Select one component rollback for the graphics fixtures' }
    if ($RootImplementation) {
        $implementation = $RootImplementation
        $component = 'render-root-2d'
        $probeName = 'render-root-rollback-probe.js'
        $install = 'installRootRollbackProbe'
        $marker = 'M6_ROOT_RESULT'
    } else {
        $implementation = $OpacityImplementation
        $component = 'ui-opacity'
        $probeName = 'opacity-rollback-probe.js'
        $install = 'installOpacityRollbackProbe'
        $marker = 'M6_OPACITY_RESULT'
    }
    if ($implementation -eq 'js') {
        $engine = (Resolve-Path (Join-Path $PSScriptRoot "build/graphics-gpu-js-$component")).Path
        & robocopy $engine (Join-Path $resources 'src/cocos-js') /E /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -gt 7) { throw 'Rollback engine copy failed' }
    }
    $entry = [IO.File]::ReadAllText((Join-Path $data 'main.js'))
    $hook = 'return application.init(cc);'
    if ($entry.Split($hook, [StringSplitOptions]::None).Count -ne 2) { throw 'Missing unique application init hook' }
    $probe = [IO.File]::ReadAllText((Join-Path $PSScriptRoot $probeName))
    [IO.File]::WriteAllText((Join-Path $resources 'main.js'), $entry.Replace($hook, "$probe`n$install(cc, '$implementation');`n$hook"))
}
if($Mode -eq 'richtext') {
    if ($RichTextImplementation -eq 'js') {
        $engine = (Resolve-Path (Join-Path $PSScriptRoot 'build/richtext-gpu-js-rich-text')).Path
        & robocopy $engine (Join-Path $resources 'src/cocos-js') /E /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -gt 7) { throw 'RichText rollback bundle copy failed' }
        $entryPath = Join-Path $resources 'main.js'
        [IO.File]::WriteAllText($entryPath, "globalThis.__m6JsRichText = true;`n" + [IO.File]::ReadAllText($entryPath))
    }
    if($FontHttpOrigin -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'Run richtext with run-font-http-native.cjs to provide its HTTP fixture' }
    [IO.File]::WriteAllText((Join-Path $resources 'm6-font-http-origin.txt'), $FontHttpOrigin, [Text.UTF8Encoding]::new($false))
    $m6Writable = Join-Path (Split-Path -Parent $exePath) 'm6-http-writable'
    New-Item -ItemType Directory -Force -Path $m6Writable | Out-Null
    $m6WritableLiteral = (($m6Writable.Replace('\','/') + '/') | ConvertTo-Json -Compress)
    $m6Main = Join-Path $resources 'main.js'
    [IO.File]::WriteAllText($m6Main, "jsb.fileUtils.setWritablePath($m6WritableLiteral);`n" + [IO.File]::ReadAllText($m6Main), [Text.UTF8Encoding]::new($false))
}
$log=Join-Path $PSScriptRoot "build/$Mode-gpu-native.log"
$err=Join-Path $PSScriptRoot "build/$Mode-gpu-native.err.log"
$manifest=Join-Path $PSScriptRoot "build/$Mode-gpu-native/manifest.json"
$started=[DateTime]::UtcNow
$process=Start-Process -FilePath $exePath -WorkingDirectory (Split-Path -Parent $exePath) -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err -PassThru
try {
    $deadline=$started.AddSeconds(180)
    while([DateTime]::UtcNow -lt $deadline) {
        if((Test-Path -LiteralPath $manifest) -and (Get-Item -LiteralPath $manifest).LastWriteTimeUtc -gt $started) {
            $result=Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
            if($result.backend -ne 'native') { throw 'Invalid native backend' }
            if($Mode -eq 'graphics' -and ($result.captures.Count -ne 88 -or $result.hits.Count -ne 22 -or $result.roots.Count -ne 11 -or $result.scenes.cycles -ne 1000)) { throw 'Invalid native capture manifest' }
            if($Mode -eq 'richtext') {
                $lifecycle = $result.text.lifecycle
                $expected = if ($RichTextImplementation -eq 'js') { 'js' } else { 'native' }
                $prefab = $result.text.prefab
                if ($prefab.implementation -ne $expected -or ($prefab.segments -join '|') -cne 'Atlas| 123' -or
                    $prefab.updatesPerBatch -ne 8 -or $prefab.samples.Count -ne 31) { throw "Invalid $expected RichText prefab result" }
                if($result.captures.Count -ne 12 -or $result.text.loaded -ne $true -or $result.text.released -ne $true -or $lifecycle.cycles -ne 1000 -or $lifecycle.cacheHits -ne 1000 -or $lifecycle.bytesPerLoad -ne 223404 -or $lifecycle.assignmentFailureRolledBack -ne $true -or $lifecycle.retrySucceeded -ne $true -or $lifecycle.missingRejected -ne $true -or $lifecycle.deferredDestroyFinished -ne $true) { throw 'Invalid native RichText manifest' }
                if($null -eq $lifecycle.cacheBefore -or $lifecycle.cacheBefore -ne $lifecycle.cacheAfter) { throw 'Native font lifecycle did not restore its baseline' }
            }
            if (($RootImplementation -or $OpacityImplementation) -and !(Select-String -LiteralPath $log -Pattern $marker -Quiet)) { throw "Missing rollback result: $marker" }
            Write-Output "M6_GPU_NATIVE_READY $($result.captures.Count)"
            exit 0
        }
        if($process.HasExited) { throw "Native GPU app exited: $($process.ExitCode); see $log and $err" }
        if((Test-Path -LiteralPath $log) -and (Select-String -LiteralPath $log -Pattern 'M6_GPU_FAIL' -Quiet)) { throw "Native GPU capture failed: $log" }
        Start-Sleep -Milliseconds 250
    }
    throw "Native capture timeout: $log"
} finally { if(-not $process.HasExited) { Stop-Process -Id $process.Id } }
