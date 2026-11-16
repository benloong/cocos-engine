param([string]$BuildDir = (Join-Path $PSScriptRoot 'build/gpu-win-asan'))
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$project = Join-Path $PSScriptRoot 'build/graphics-gpu-project'
$compiler = Get-Command cl.exe -ErrorAction Stop
$build = [IO.Path]::GetFullPath($BuildDir)
$source = Join-Path $project 'native/engine/win64'
$resources = (Join-Path $project 'build/windows').Replace('\', '/')
if (-not (Test-Path (Join-Path $source 'CMakeLists.txt'))) { throw 'Prepare and build the GPU fixture with cocos-cli first.' }
if (-not (Test-Path "$resources/proj/cfg.cmake")) { throw 'Build the Windows fixture first; use build-config-web.json for Web to preserve Windows resources.' }
$configure = @('-S', $source, '-B', $build, '-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Debug',
    "-DRES_DIR=$resources", '-DCMAKE_CXX_FLAGS_DEBUG=/Z7 /Ob0 /Od /fsanitize=address',
    '-DCMAKE_C_FLAGS_DEBUG=/Z7 /Ob0 /Od /fsanitize=address', '-DCMAKE_EXE_LINKER_FLAGS_DEBUG=/DEBUG /INCREMENTAL:NO')
& cmake @configure
if ($LASTEXITCODE -ne 0) { throw 'ASAN configure failed' }

# Match the installed compiler's actual language; VSLANG is not sufficient on
# installations without English resources. A bad prefix silently loses deps.
$probe = Join-Path $build 'm6-msvc-prefix.cpp'
[IO.File]::WriteAllText($probe, "#include <cstdint>`n")
$includes = & $compiler.Source /nologo /showIncludes /c $probe "/Fo$build/m6-msvc-prefix.obj" 2>&1
if ($LASTEXITCODE -ne 0) { throw 'MSVC include-prefix probe failed' }
$line = $includes | ForEach-Object { $_.ToString() } | Where-Object { $_ -match '[A-Za-z]:[\\/].*cstdint$' } | Select-Object -First 1
if (-not $line) { throw 'Could not identify MSVC include prefix' }
$includesPrefix = [regex]::Match($line, '^(.*?)(?=[A-Za-z]:[\\/])').Groups[1].Value
$repaired = $false
foreach ($version in (Get-ChildItem (Join-Path $build 'CMakeFiles') -Directory | Where-Object Name -Match '^\d+\.\d+')) {
    foreach ($language in @('C', 'CXX')) {
        $file = Join-Path $version.FullName "CMake${language}Compiler.cmake"
        if (-not (Test-Path -LiteralPath $file)) { continue }
        $content = [IO.File]::ReadAllText($file)
        $updated = [regex]::Replace($content, 'set\(CMAKE_(C|CXX)_CL_SHOWINCLUDES_PREFIX "[^"]*"\)', {
            param($match)
            'set(CMAKE_' + $match.Groups[1].Value + '_CL_SHOWINCLUDES_PREFIX "' + $includesPrefix + '")'
        })
        if ($updated -ne $content) { [IO.File]::WriteAllText($file, $updated); $repaired = $true }
    }
}
& cmake @configure
if ($LASTEXITCODE -ne 0) { throw 'ASAN reconfigure failed' }
$buildArgs = @('--build', $build, '-j', '8')
if ($repaired) { $buildArgs += '--clean-first' }
& cmake @buildArgs
if ($LASTEXITCODE -ne 0) { throw 'ASAN build failed' }
foreach ($name in @('clang_rt.asan_dbg_dynamic-x86_64.dll', 'clang_rt.asan_dynamic-x86_64.dll')) {
    Copy-Item -LiteralPath (Join-Path (Split-Path $compiler.Source -Parent) $name) -Destination $build -Force
}
$previousOptions = $env:ASAN_OPTIONS
try {
    $env:ASAN_OPTIONS = 'halt_on_error=1'
    Push-Location $repo
    try { & (Join-Path $PSScriptRoot 'run-graphics-gpu-native.ps1') -Exe (Join-Path $build 'native-2d-m6-gpu.exe') }
    finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'ASAN scene matrix failed' }
    $output = Join-Path $PSScriptRoot 'build/graphics-gpu-native-asan'
    & robocopy (Join-Path $PSScriptRoot 'build/graphics-gpu-native') $output /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -gt 7) { throw 'ASAN result copy failed' }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'build/graphics-gpu-native.err.log') -Destination (Join-Path $PSScriptRoot 'build/scene-matrix-asan-errors.log') -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'build/graphics-gpu-native.log') -Destination (Join-Path $PSScriptRoot 'build/scene-matrix-asan-native.log') -Force
    Write-Output 'M6_SCENE_ASAN_READY 1000'
} finally { $env:ASAN_OPTIONS = $previousOptions }
exit 0
