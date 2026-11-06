$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$cocosRoot = Join-Path $repoRoot 'native/cocos'
$outDir = Join-Path $PSScriptRoot 'build'
$exe = Join-Path $outDir 'cc-2d-poc-tests.exe'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$sources = @(
    (Join-Path $repoRoot 'native/tests/2d-poc/test_2d_poc.cpp'),
    (Join-Path $cocosRoot '2d/framework/UITransformMath.cpp'),
    (Join-Path $cocosRoot '2d/renderer/SpriteGeometry.cpp'),
    (Join-Path $cocosRoot 'math/Mat4.cpp'),
    (Join-Path $cocosRoot 'math/Mat3.cpp'),
    (Join-Path $cocosRoot 'math/Vec3.cpp'),
    (Join-Path $cocosRoot 'math/MathUtil.cpp'),
    (Join-Path $cocosRoot 'math/Quaternion.cpp'),
    (Join-Path $cocosRoot 'math/Math.cpp'),
    (Join-Path $cocosRoot 'math/Geometry.cpp')
)

# The standalone target does not link the engine or its external libraries.
# CC_PLATFORM_EMSCRIPTEN skips the boost-based hash include in MathBase; the
# code under test only uses the math types.
$defines = @(
    '-DCC_STATIC',
    '-DM_PI=3.14159265358979323846',
    '-DCC_PLATFORM=9',
    '-DCC_PLATFORM_EMSCRIPTEN=9',
    '-DCC_PLATFORM_WINDOWS=2',
    '-DCC_PLATFORM_MACOS=4',
    '-DCC_PLATFORM_IOS=1',
    '-DCC_PLATFORM_ANDROID=3',
    '-DCC_PLATFORM_OHOS=5',
    '-DCC_PLATFORM_LINUX=6',
    '-DCC_PLATFORM_QNX=7',
    '-DCC_PLATFORM_NX=8',
    '-DCC_PLATFORM_OPENHARMONY=10'
)

& g++ -std=c++17 -O2 @defines -I $cocosRoot @sources -o $exe
if ($LASTEXITCODE -ne 0) {
    throw "compilation failed with exit code $LASTEXITCODE"
}

& $exe
exit $LASTEXITCODE
