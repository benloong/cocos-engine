param([Parameter(Mandatory)][ValidatePattern('^[0-9a-f]{10}$')][string]$CandidateRevision, [switch]$NativeOnly, [string]$OutputFile)
$ErrorActionPreference = 'Stop'
$build = Join-Path $PSScriptRoot 'build'
$runner = Join-Path $PSScriptRoot 'run-m6-perf.ps1'
$scene = Join-Path $build 'perf-project-before/build/windows/data'
$prefix = Join-Path $build "m6-perf-gate-$CandidateRevision"
$candidateBinary = Join-Path $build "perf-bin-full-$CandidateRevision"

# Match the Windows workload and alternate which executable starts first.
foreach ($round in 1..6) {
    $order = if ($round % 2) { 'before', 'after' } else { 'after', 'before' }
    foreach ($target in $order) {
        $argsForRun = if ($target -eq 'after') {
            @('-ProjectRevision', $CandidateRevision, '-BinaryDirectory', $candidateBinary)
        } else { @() }
        $log = "$prefix-$round-$target.log"
        & pwsh -NoProfile -File $runner -Target $target -ResourceTemplateDirectory $scene @argsForRun *> $log
        $exit = $LASTEXITCODE
        if ($exit) { Get-Content -LiteralPath $log -Tail 20; exit $exit }
        Copy-Item -LiteralPath (Join-Path $build "m6-perf-$target-results.json") -Destination "$prefix-$round-$target.json"
        Write-Output "M6 Windows Release pair $round $target ready"
    }
}

if (!$NativeOnly) {
    $log = "$prefix-1-web.log"
    & pwsh -NoProfile -File $runner -Target web -ProjectRevision $CandidateRevision *> $log
    $exit = $LASTEXITCODE
    if ($exit) { Get-Content -LiteralPath $log -Tail 20; exit $exit }
    Copy-Item -LiteralPath (Join-Path $build 'perf-web/manifest.json') -Destination "$prefix-1-web.json"
}
$compareArgs = @('--gate', $CandidateRevision)
if ($NativeOnly) { $compareArgs += '--native-only' }
if ($OutputFile) { $compareArgs += @('--output-file', $OutputFile) }
& node (Join-Path $PSScriptRoot 'compare-m6-perf.cjs') @compareArgs
exit $LASTEXITCODE
