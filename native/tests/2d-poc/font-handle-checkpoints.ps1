Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class M6FontHandles {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetProcessHandleCount(IntPtr process, out uint count);

    [DllImport("user32.dll")]
    public static extern uint GetGuiResources(IntPtr process, uint flags);
}
'@

function Test-FontExclusiveRead([string]$Path) {
    try {
        $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
        $stream.Dispose()
        return $true
    } catch {
        if (($_.Exception.GetBaseException().HResult -band 0xffff) -ne 32) { throw }
        return $false
    }
}

function New-FontHandleSampler([string]$Writable, [string]$Fixture) {
    $held = [IO.File]::Open($Fixture, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        if (Test-FontExclusiveRead $Fixture) { throw 'Exclusive font read did not detect the control reader' }
    } finally { $held.Dispose() }
    if (!(Test-FontExclusiveRead $Fixture)) { throw 'Font fixture already has an open reader' }
    $directory = Join-Path $Writable ('font-checkpoints-' + [guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    return @{
        Directory = $directory
        Writable = $Writable.TrimEnd('\') + '\'
        Fixture = $Fixture
        Phases = @('local-25', 'local-250', 'local-500', 'local-750', 'local-1000', 'before-http', 'http-released',
            'after-http', 'http-10', 'http-30', 'after-http-repeats')
        Samples = [Collections.Generic.List[object]]::new()
    }
}

function Read-FontHandleCheckpoint($Sampler, [Diagnostics.Process]$Process, [string]$Log) {
    $marker = 'M6_FONT_HANDLE_CHECKPOINT '
    $match = Select-String -LiteralPath $Log -SimpleMatch $marker | Select-Object -Last 1
    if (!$match) { return }
    $payload = $match.Line.Substring($match.Line.IndexOf($marker) + $marker.Length)
    try { $request = ConvertFrom-Json -InputObject $payload -ErrorAction Stop } catch { return }
    if ($Sampler.Samples.Count -and $Sampler.Samples[$Sampler.Samples.Count - 1].phase -eq $request.name) { return }
    if ($request.name -ne $Sampler.Phases[$Sampler.Samples.Count]) { throw "Unexpected font checkpoint: $($request.name)" }

    $source = [IO.Path]::GetFullPath($request.fontPath)
    if ($request.name -in @('http-released', 'http-10', 'http-30')) {
        if (!$source.StartsWith($Sampler.Writable, [StringComparison]::OrdinalIgnoreCase)) { throw 'HTTP font is outside the fixture cache' }
    } elseif ($source -ine $Sampler.Fixture) { throw 'Unexpected local font source' }
    $handles = [uint32]0
    if (![M6FontHandles]::GetProcessHandleCount($Process.Handle, [ref]$handles)) { throw 'Could not sample application handles' }
    $gdi = [M6FontHandles]::GetGuiResources($Process.Handle, 0)
    $user = [M6FontHandles]::GetGuiResources($Process.Handle, 1)
    $exclusive = Test-FontExclusiveRead $source
    $Sampler.Samples.Add([ordered]@{
        phase = $request.name
        processHandles = $handles
        gdiObjects = $gdi
        userObjects = $user
        exclusiveRead = $exclusive
    })
    if (!$exclusive) { throw "The released font is still in use at $($request.name)" }
    [IO.File]::WriteAllText((Join-Path $Sampler.Directory ($request.name + '.ack')), '')
}
