param([string]$Exe = (Join-Path $PSScriptRoot 'build/gpu-win/native-2d-m6-gpu.exe'), [ValidateSet('graphics','richtext')][string]$Mode = 'graphics', [string]$FontHttpOrigin = '',
    [ValidateSet('native','js')][string]$OpacityImplementation,
    [ValidateSet('native','js')][string]$RootImplementation,
    [ValidateSet('native','js')][string]$SpriteImplementation,
    [ValidateSet('native','js')][string]$RichTextImplementation,
    [ValidateSet('native','js')][string]$LabelImplementation,
    [ValidateSet('native','js')][string]$GraphicsMaskImplementation)
$ErrorActionPreference = 'Stop'
function Get-CaptureHash([string]$Path) {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $stream = [IO.File]::OpenRead($Path)
        try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
        finally { $stream.Dispose() }
    } finally { $algorithm.Dispose() }
}
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
$componentSelection = [ordered]@{ Sprite = $SpriteImplementation; Label = $LabelImplementation; GraphicsMask = $GraphicsMaskImplementation }
$selectedComponents = @($componentSelection.Keys | Where-Object { $componentSelection[$_] })
if ($selectedComponents.Count) {
    if ($Mode -ne 'graphics' -or $OpacityImplementation -or $RootImplementation -or $selectedComponents.Count -ne 1) { throw 'Select one graphics component rollback' }
    $component = $selectedComponents[0]
    $implementation = $componentSelection[$component]
    if ($implementation -eq 'js') {
        $bundle = if ($component -eq 'GraphicsMask') { 'graphics-mask' } else { $component.ToLowerInvariant() }
        $engine = (Resolve-Path (Join-Path $PSScriptRoot "build/graphics-gpu-js-$bundle")).Path
        & robocopy $engine (Join-Path $resources 'src/cocos-js') /E /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -gt 7) { throw "$component rollback bundle copy failed" }
    }
    $entryPath = Join-Path $resources 'main.js'
    $markerScript = "globalThis.__m6${component}Implementation = '$implementation';"
    if ($component -eq 'GraphicsMask') { $markerScript += "globalThis.__m6SpriteImplementation = '$implementation';" }
    [IO.File]::WriteAllText($entryPath, $markerScript + [Environment]::NewLine + [IO.File]::ReadAllText($entryPath))
}
if($Mode -eq 'richtext') {
    $expectedCaptures = & node -e "console.log(require(process.argv[1]).captures.join('|'))" (Join-Path $PSScriptRoot 'richtext-gpu-cases.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Could not read expected RichText captures' }
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
            if($Mode -eq 'graphics' -and ($result.captures.Count -ne 138 -or $result.hits.Count -ne 22 -or $result.roots.Count -ne 11 -or $result.scenes.cycles -ne 1000)) { throw 'Invalid native capture manifest' }
            if ($selectedComponents.Count) {
                $key = $component.Substring(0, 1).ToLowerInvariant() + $component.Substring(1)
                if ($result."${key}Implementation" -ne $implementation) { throw "Unexpected $component implementation" }
                $performance = $result."${key}Benchmark"
                $sampleCount = if ($component -eq 'Label') { 31 } else { 60 }
                $warmupOk = if ($component -eq 'Label') { $performance.warmupBatches -eq 10 } else { $performance.warmupFrames -eq 30 }
                if (!$warmupOk -or $performance.samples.Count -ne $sampleCount -or
                    @($performance.samples | Where-Object { $_ -le 0 -or ![double]::IsFinite($_) }).Count) { throw "Invalid $component rollback performance capture" }
                if ($component -eq 'Sprite' -and $performance.spriteCount -ne 128) { throw 'Invalid Sprite benchmark count' }
                if ($component -eq 'Label' -and ($performance.updatesPerBatch -ne 8 -or $performance.visiblePixels -le 0)) { throw 'Invalid Label benchmark result' }
                if ($component -eq 'GraphicsMask' -and ($result.spriteImplementation -ne $implementation -or $performance.rectangles -ne 64 -or $performance.visiblePixels -le 0)) { throw 'Invalid Graphics/Mask benchmark result' }
                $bundleSource = if ($implementation -eq 'js') { Join-Path $engine 'cc.js' } else { Join-Path $data 'src/cocos-js/cc.js' }
                $deployed = Get-CaptureHash (Join-Path $resources 'src/cocos-js/cc.js')
                if ($deployed -ne (Get-CaptureHash $bundleSource)) { throw "$component rollback deployed the wrong engine bundle" }
                $result | Add-Member -NotePropertyName "${key}EngineSha256" -NotePropertyValue $deployed
                $result | Add-Member -NotePropertyName executableSha256 -NotePropertyValue (Get-CaptureHash $exePath)
                [IO.File]::WriteAllText($manifest, ($result | ConvertTo-Json -Depth 100 -Compress), [Text.UTF8Encoding]::new($false))
            }
            if($Mode -eq 'richtext') {
                $lifecycle = $result.text.lifecycle
                $expected = if ($RichTextImplementation -eq 'js') { 'js' } else { 'native' }
                $prefab = $result.text.prefab
                if ($prefab.implementation -ne $expected -or $prefab.segments.Count -ne 2 -or !$prefab.restoredPixels -or
                    $prefab.updatesPerBatch -ne 8 -or $prefab.samples.Count -ne 31) { throw "Invalid $expected RichText prefab result" }
                if(($result.captures -join '|') -cne $expectedCaptures -or $result.text.loaded -ne $true -or $result.text.released -ne $true -or $lifecycle.cycles -ne 1000 -or $lifecycle.cacheHits -ne 1000 -or $lifecycle.bytesPerLoad -ne 223404 -or $lifecycle.assignmentFailureRolledBack -ne $true -or $lifecycle.retrySucceeded -ne $true -or $lifecycle.missingRejected -ne $true -or $lifecycle.deferredDestroyFinished -ne $true) { throw 'Invalid native RichText manifest' }
                if($null -eq $lifecycle.cacheBefore -or $lifecycle.cacheBefore -ne $lifecycle.cacheAfter) { throw 'Native font lifecycle did not restore its baseline' }
                $digests = [ordered]@{}
                foreach ($name in $result.captures) {
                    $image = Get-Item -LiteralPath (Join-Path (Split-Path -Parent $manifest) "$name.rgba")
                    if ($image.LastWriteTimeUtc -lt $started -or $image.Length -ne 262144) { throw "Stale or incomplete native capture: $name" }
                    $digests[$name] = Get-CaptureHash $image.FullName
                }
                $result | Add-Member -NotePropertyName captureSha256 -NotePropertyValue $digests
                $result | Add-Member -NotePropertyName executableSha256 -NotePropertyValue (Get-CaptureHash $exePath)
                [IO.File]::WriteAllText($manifest, ($result | ConvertTo-Json -Depth 100 -Compress), [Text.UTF8Encoding]::new($false))
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
