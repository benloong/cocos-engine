param(
    [Parameter(Mandatory)][string]$Executable,
    [Parameter(Mandatory)][ValidateSet('Debug', 'Release')][string]$Configuration,
    [Parameter(Mandatory)][ValidateSet('native-before', 'js', 'native-restored')][string]$Phase,
    [ValidateSet('ui-opacity', 'render-root')][string]$Probe = 'ui-opacity'
)

$ErrorActionPreference = 'Stop'
$build = Join-Path $PSScriptRoot 'build'
$projectData = Join-Path $build "old-$Probe-project/build/windows/data"
$fallback = Join-Path $build "old-$Probe-fallback"
$application = Join-Path $build "old-$Probe-$Configuration-$Phase"
$marker = if ($Probe -eq 'render-root') { 'M6_OLD_ROOT' } else { 'M6_OLD_OPACITY' }
$resources = Join-Path $application 'Resources'
if (!(Test-Path -LiteralPath "$projectData/src/cocos-js/cc.js")) { throw 'Build the old Windows project first' }
if ($Phase -eq 'js' -and !(Test-Path -LiteralPath "$fallback/cc.js")) { throw 'Build the old project fallback engine first' }
$original = Get-Item -LiteralPath $Executable
New-Item -ItemType Directory -Path $resources -Force | Out-Null
Copy-Item -LiteralPath $original.FullName -Destination $application -Force
Get-ChildItem -LiteralPath $original.DirectoryName -File -Filter '*.dll' | Copy-Item -Destination $application -Force
Copy-Item -Path "$projectData/*" -Destination $resources -Recurse -Force
if ($Phase -eq 'js') {
    Copy-Item -Path "$fallback/*" -Destination "$resources/src/cocos-js" -Recurse -Force
}

$app = Join-Path $application $original.Name
$log = Join-Path $application 'console.log'
$process = Start-Process -FilePath $app -WorkingDirectory $application -WindowStyle Hidden `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru
try {
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    do {
        Start-Sleep -Milliseconds 250
        $complete = Select-String -LiteralPath $log -Pattern "${marker}_(DONE|FAIL) " | Select-Object -Last 1
    } until ($complete -or $process.HasExited -or [DateTime]::UtcNow -ge $deadline)
    if (!$complete -or $complete.Line -match "${marker}_FAIL ") {
        Get-Content -LiteralPath $log -Tail 12
        throw "Old $Probe failed for $Configuration/$Phase"
    }
    $identity = [ordered]@{
        executableSha256 = (Get-FileHash -LiteralPath $app).Hash.ToLowerInvariant()
        engineSha256 = (Get-FileHash -LiteralPath "$resources/src/cocos-js/cc.js").Hash.ToLowerInvariant()
    }
    $identity | ConvertTo-Json | Set-Content -LiteralPath "$application/build-identities.json"
    Write-Host "Windows $Configuration $Phase capture complete"
} finally {
    if (!$process.HasExited) { $process.Kill(); $process.WaitForExit() }
}
