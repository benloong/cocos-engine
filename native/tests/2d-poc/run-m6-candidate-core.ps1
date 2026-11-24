param([Parameter(Mandatory)][string]$Repository,[Parameter(Mandatory)][string]$EngineDirectory,
 [Parameter(Mandatory)][string]$ResourceDirectory,[Parameter(Mandatory)][string]$OutputRoot,
 [Parameter(Mandatory)][string]$CapturePathSource,[string[]]$Configurations=@('Debug','Release'))
$ErrorActionPreference='Stop'
$engine=Get-Content -Raw (Join-Path $EngineDirectory 'candidate-engine.json') | ConvertFrom-Json
$rows=@()
foreach($cfg in $Configurations) {
 $stage=Join-Path $OutputRoot "core-$cfg"
 if(Test-Path -LiteralPath $stage){throw "Stage must be new: $stage"}
 $captures=Join-Path $stage 'captures'; New-Item -ItemType Directory -Force -Path $captures | Out-Null
 $bin=Join-Path $Repository $(if($cfg -eq 'Debug'){'native/tests/2d-poc/build/gpu-win'}else{'native/tests/2d-poc/build/gpu-win-release'})
 Get-ChildItem -LiteralPath $bin -File | Where-Object {$_.Extension -in '.exe','.dll'} | Copy-Item -Destination $stage
 $resources=Join-Path $stage 'Resources'
 & robocopy $ResourceDirectory $resources /E /NFL /NDL /NJH /NJS /NP | Out-Null
 if($LASTEXITCODE -gt 7){throw 'Resource copy failed'}
 foreach($chunk in $engine.chunks.PSObject.Properties) {
  $target=Join-Path $resources "src/cocos-js/$($chunk.Name)"
  New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
  Copy-Item -LiteralPath (Join-Path $EngineDirectory $chunk.Name) -Destination $target
  if((Get-FileHash $target).Hash -ne $chunk.Value){throw 'Deployed Native chunk hash mismatch'}
 }
 $old=(Join-Path $CapturePathSource 'native/tests/2d-poc/build/graphics-gpu-native').Replace('\','/')
 $relocated=0
 Get-ChildItem $resources -Recurse -File | Where-Object {$_.Extension -in '.js','.json' -and $_.FullName -notlike '*cocos-js*'} | ForEach-Object {
  $s=[IO.File]::ReadAllText($_.FullName)
  if($s.Contains($old)){[IO.File]::WriteAllText($_.FullName,$s.Replace($old,$captures.Replace('\','/')),[Text.UTF8Encoding]::new($false));$relocated++}
 }
 if(!$relocated){throw 'Expected capture path not found'}
 Copy-Item (Join-Path $Repository 'native/tests/2d-poc/fixtures/acceptance/M6CandidateLifecycle.js') (Join-Path $resources 'candidate-lifecycle.js')
 $manifest=Join-Path $captures 'manifest.json'; $lifecycle=Join-Path $stage 'lifecycle.json'
 $main=Join-Path $resources 'main.js';$text=[IO.File]::ReadAllText($main)
 $hook='return application.start();'
 if(!$text.Contains($hook)){throw 'Application start hook missing'}
 $m=$manifest.Replace('\','/')|ConvertTo-Json -Compress;$l=$lifecycle.Replace('\','/')|ConvertTo-Json -Compress
 $text=$text.Replace($hook,"return Promise.resolve(application.start()).then(() => System.import('cc')).then((cc) => { require('candidate-lifecycle.js'); globalThis.installM6CandidateLifecycle(cc, $m, $l); });")
 $writable=Join-Path $stage 'writable';New-Item -ItemType Directory -Force $writable|Out-Null
 $w=($writable.Replace('\','/')+'/')|ConvertTo-Json -Compress
 [IO.File]::WriteAllText($main,"jsb.fileUtils.setWritablePath($w);"+[Environment]::NewLine+$text,[Text.UTF8Encoding]::new($false))
 $exe=Join-Path $stage 'native-2d-m6-gpu.exe';$log=Join-Path $stage 'stdout.log';$err=Join-Path $stage 'stderr.log'
 $p=Start-Process -FilePath $exe -WorkingDirectory $stage -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err -PassThru
 $started=[DateTime]::UtcNow;$passed=$false;$reason='timeout'
 try {
  while(([DateTime]::UtcNow-$started).TotalSeconds -lt 180) {
   if(Test-Path $lifecycle){$c=Get-Content -Raw $lifecycle|ConvertFrom-Json;$f=Get-Content -Raw $manifest|ConvertFrom-Json;$passed=$c.passed -and $f.captures.Count -eq 146 -and $f.hits.Count -eq 22 -and $f.roots.Count -eq 11 -and $f.scenes.cycles -eq 1000;$reason=if($passed){'complete'}else{'assertion failed'};break}
   if((Test-Path $log) -and (Select-String $log -Pattern 'M6_GPU_FAIL|M6_CANDIDATE_LIFECYCLE_FAIL' -Quiet)){$reason='fixture failure';break}
   if($p.HasExited){$reason="process exit $($p.ExitCode)";break}
   Start-Sleep -Milliseconds 250
  }
 } finally {if(!$p.HasExited){Stop-Process -Id $p.Id}}
 $diagnostics=@(Select-String -Path $log,$err -Pattern 'GL error|M6_GPU_FAIL|M6_CANDIDATE_LIFECYCLE_FAIL|heap-use-after-free|AddressSanitizer'|ForEach-Object Line)
 $passed=$passed -and !$diagnostics.Count
 $row=@{configuration=$cfg;passed=$passed;reason=$reason;seconds=([DateTime]::UtcNow-$started).TotalSeconds;engineSha256=(Get-FileHash (Join-Path $resources 'src/cocos-js/cc.js')).Hash;executableSha256=(Get-FileHash $exe).Hash;diagnostics=$diagnostics}
 $rows+=$row;$rows|ConvertTo-Json -Depth 6|Set-Content (Join-Path $OutputRoot 'core-results.json')
 Write-Output "$cfg passed=$passed reason=$reason"
 if(!$passed){throw "Candidate $cfg failed: $reason"}
}

# robocopy may leave a successful nonzero copy status in LASTEXITCODE.
exit 0
