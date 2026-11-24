"""Check the Windows font release diagnostic with a known external reader."""
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hold_reader(path, child):
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    open_file = kernel.CreateFileW
    open_file.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p,
                          wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    open_file.restype = wintypes.HANDLE
    close = kernel.CloseHandle
    close.argtypes = [wintypes.HANDLE]
    close.restype = wintypes.BOOL
    deadline = time.monotonic() + 30
    while child.poll() is None and time.monotonic() < deadline:
        # Wait for the probe to replace its initially empty source with a font.
        if path.is_file() and path.stat().st_size > 7:
            handle = open_file(str(path), 0x80000000, 7, None, 3, 0, None)
            if handle != wintypes.HANDLE(-1).value:
                try:
                    return child.communicate(timeout=30)[0]
                finally:
                    if not close(handle):
                        raise ctypes.WinError(ctypes.get_last_error())
        time.sleep(0.001)
    raise RuntimeError("Did not acquire a reader while the probe was running")


def run(exe, directory, held):
    directory.mkdir(parents=True)
    env = dict(os.environ, CC_M6_FONT_PROBE_DIRECTORY=str(directory), CC_M6_FONT_DIAGNOSTIC_CONTROL="1")
    with subprocess.Popen([str(exe), "--directwrite-file-probe"], cwd=directory, env=env,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT) as child:
        try:
            first = child.stdout.readline()
            match = re.fullmatch(rb"M6_FONT_FILE_START pid=(\d+) path=(.+)", first.rstrip())
            assert match and int(match[1]) == child.pid
            path = Path(os.fsdecode(match[2]))
            assert path.parent == directory
            rest = hold_reader(path, child) if held else child.communicate(timeout=120)[0]
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()
    log = directory / "probe.log"
    log.write_bytes(first + rest)
    text = rest.decode(errors="replace")
    assert "intentional-held-reader-control error=32" in text
    if held:
        assert child.returncode == 1
        _, failure = text.split("M6_FONT_FILE_FAILURE stage=after-valid-font-release error=32", 1)
        assert re.search(rf"^M6_FONT_FILE_OWNER pid={os.getpid()} observer=0 image=.+", failure, re.M)
    else:
        assert child.returncode == 0 and "M6_FONT_FILE_FAILURE" not in text
        checkpoints = re.findall(r"cycles (\d+) handles (\d+) -> (\d+) GDI (\d+) -> (\d+)", text)
        assert [int(c[0]) for c in checkpoints] == [250, 500, 750, 1000]
        assert all(before == after and gdi == current for _, before, after, gdi, current in checkpoints)
    assert not path.exists()
    return {"externalReader": held, "readerPid": os.getpid() if held else None,
            "probePid": child.pid, "exitCode": child.returncode, "logSha256": digest(log)}


if __name__ == "__main__":
    core_file, output = map(Path, sys.argv[1:])
    core = json.loads(core_file.read_text(encoding="utf-8"))
    root = Path(__file__).resolve().parents[3]
    output = output.resolve()
    report = {"candidate": core["candidate"], "artifacts": output.relative_to(root).as_posix(),
              "scope": "Known external file reader followed by a separate 1000-cycle run without that reader.", "runs": []}
    for build in core["runs"]:
        exe = root / build["buildDirectory"] / "cc2d_native_poc.exe"
        assert digest(exe) == build["exeSha256"].lower()
        for held in (True, False):
            config = build["configuration"]
            directory = output / config / ("held" if held else "released")
            result = run(exe, directory, held)
            report["runs"].append({"configuration": config, "exeSha256": digest(exe), **result})
            print(config, directory.name, "PASS", flush=True)
    (output / "summary.json").write_bytes((json.dumps(report, indent=2) + "\n").encode())
