param([Parameter(Mandatory)][string]$Repository,[Parameter(Mandatory)][string]$DebugApplication,
 [Parameter(Mandatory)][string]$ReleaseApplication,[Parameter(Mandatory)][string]$EngineDirectory,
 [Parameter(Mandatory)][string]$OutputRoot,[ValidateRange(1,100)][int]$Rounds=10)
$ErrorActionPreference='Stop'
if(Test-Path $OutputRoot){throw 'Scheduling output must be new'}
New-Item -ItemType Directory -Force $OutputRoot|Out-Null
$engine=Get-Content -Raw (Join-Path $EngineDirectory 'candidate-engine.json')|ConvertFrom-Json
$apps=@{Debug=(Resolve-Path $DebugApplication).Path;Release=(Resolve-Path $ReleaseApplication).Path}
$hashes=@{}
foreach($cfg in 'Debug','Release'){
 $exe=$apps[$cfg];$cc=Join-Path (Split-Path $exe) 'Resources/src/cocos-js/cc.js'
 if((Get-FileHash $cc).Hash -ne $engine.chunks.'cc.js'){throw 'Scheduling Native package differs from candidate'}
 $hashes[$cfg]=@{applicationSha256=(Get-FileHash $exe).Hash;engineSha256=(Get-FileHash $cc).Hash}
}
$runs=@();$failed=0
foreach($round in 1..$Rounds){
 foreach($cfg in 'Debug','Release'){
  $dir=Join-Path $OutputRoot "$round-$cfg";$log=Join-Path $OutputRoot "$round-$cfg.log"
  & pwsh -NoProfile -File (Join-Path $Repository 'native/tests/2d-poc/run-m5-richtext-probe.ps1') -AppExe $apps[$cfg] -TimeoutSeconds 45 -LogDirectory $dir *> $log
  $code=$LASTEXITCODE;$reason=$null;$report=$null
  $files=@(Get-ChildItem -LiteralPath $dir -Filter '*.json' -File -ErrorAction SilentlyContinue)
  try{
   if($files.Count -ne 1){throw 'Expected exactly one run report'}
   $report=Get-Content -Raw $files[0].FullName|ConvertFrom-Json
   if($code -ne 0 -or !$report.passed){throw 'M5 probe failed'}
   if(!$report.aliveBeforeCleanup -or $null -ne $report.exitBeforeCleanup -or $report.samples.Count -lt 2 -or @($report.timeline -match 'M5_RICHTEXT ').Count -ne 1){throw 'Incomplete Native application timeline'}
   if($report.timeoutSeconds -ne 45 -or $report.elapsedSeconds -gt 45){throw 'Startup exceeded unchanged 45-second budget'}
   if($report.appSha256 -ne $hashes[$cfg].applicationSha256){throw 'Application changed between rounds'}
  }catch{$reason=$_.Exception.Message;$failed++}
  $row=[ordered]@{round=$round;configuration=$cfg;passed=($null -eq $reason);exitCode=$code;reason=$reason;seconds=$report.elapsedSeconds;aliveBeforeCleanup=$report.aliveBeforeCleanup;exitBeforeCleanup=$report.exitBeforeCleanup;applicationSha256=$hashes[$cfg].applicationSha256;engineSha256=$hashes[$cfg].engineSha256;report=if($files.Count -eq 1){$files[0].FullName}else{$null};log=$log}
  $runs+=$row
  [ordered]@{candidateImplementation=$engine.revision;rounds=$Rounds;timeoutSeconds=45;expectedRuns=2*$Rounds;completedRuns=$runs.Count;failedRuns=$failed;passed=($runs.Count -eq 2*$Rounds -and $failed -eq 0);runs=$runs}|ConvertTo-Json -Depth 8|Set-Content (Join-Path $OutputRoot 'summary.json')
  Write-Output "round=$round config=$cfg passed=$($row.passed) seconds=$($row.seconds)"
 }
}
if($failed){throw "$failed scheduling runs failed; all attempts retained"}
Write-Output "M6_CANDIDATE_SCHEDULING_PASS $($runs.Count)"
exit 0
