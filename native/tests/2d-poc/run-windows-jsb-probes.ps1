param([Parameter(Mandatory)][string]$Executable)
$ErrorActionPreference = 'Stop'
$binary = (Resolve-Path -LiteralPath $Executable).Path
$scripts = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force -Path $scripts | Out-Null

# Each shell runs in a fresh V8 instance with the DLLs from this build.
Push-Location -LiteralPath (Split-Path -Parent $binary)
try {
    foreach ($probe in 'renderer-manager', 'sprite-api', 'sprite-atlas', 'font-assets', 'layout', 'richtext-runtime') {
        Write-Host "Running $probe with $binary"
        & node (Join-Path $PSScriptRoot "build-$probe-probe.cjs")
        if ($LASTEXITCODE -ne 0) { throw "Could not generate $probe" }
        $output = & $binary (Join-Path $scripts "$probe-probe.js")
        $output | Write-Output
        if ($LASTEXITCODE -ne 0) { throw "$probe failed with exit code $LASTEXITCODE" }
        if ($output -notcontains 'jsb shell integration: OK' -or $output -notcontains 'jsb scene record: OK') {
            throw "$probe did not complete the JSB shell and scene checks"
        }
    }
} finally {
    Pop-Location
}
