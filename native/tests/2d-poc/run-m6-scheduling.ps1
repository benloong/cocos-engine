param(
    [Parameter(Mandatory)][string]$BuildDirectory,
    [ValidateRange(1, 100)][int]$Rounds = 10
)
$ErrorActionPreference = 'Stop'
$output = Join-Path $PSScriptRoot ('build/m6-scheduling-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $output | Out-Null
$runs = @()
foreach ($round in 1..$Rounds) {
    foreach ($config in @('Debug', 'Release')) {
        $exe = (Resolve-Path (Join-Path $BuildDirectory "$config/cocos-m1-test.exe")).Path
        $directory = Join-Path $output "$round-$config"
        & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'run-m5-richtext-probe.ps1') -AppExe $exe -LogDirectory $directory
        if ($LASTEXITCODE) { throw "Scheduling probe failed at round $round on $config. See $directory" }
        $report = Get-Content -Raw (Join-Path $directory '*.json') | ConvertFrom-Json
        if (!$report.passed -or !$report.aliveBeforeCleanup -or $null -ne $report.exitBeforeCleanup -or
            $report.samples.Count -lt 2 -or @($report.timeline -match 'M5_RICHTEXT ').Count -ne 1) {
            throw "Invalid application timeline in $directory"
        }
        $runs += [ordered]@{ config = $config; round = $round; appSha256 = $report.appSha256
            run = $report.run; seconds = $report.elapsedSeconds; samples = $report.samples.Count
            passed = $report.passed; aliveBeforeCleanup = $report.aliveBeforeCleanup; exitBeforeCleanup = $report.exitBeforeCleanup }
        ConvertTo-Json -InputObject $runs -Depth 4 | Set-Content (Join-Path $output 'summary.json') -Encoding utf8
    }
}
Write-Output "M6_SCHEDULING_READY $output"
