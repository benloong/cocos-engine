param([Parameter(Mandatory)][string]$Repository,[Parameter(Mandatory)][string]$OutputRoot,[Parameter(Mandatory)][string]$EngineDirectory,[ValidateSet('Debug','Release')][string[]]$Configurations=@('Debug','Release'))
$ErrorActionPreference='Stop'
$core=Join-Path $Repository 'native/tests/2d-poc/build/m6-core-accept-2026-11-23T14-54-24-737Z'
$engine=Get-Content -Raw (Join-Path $EngineDirectory 'candidate-engine.json') | ConvertFrom-Json
$rows=@()
foreach($cfg in $Configurations) {
 $referenceConfig=$cfg
 $old=Join-Path $core "richtext-$referenceConfig"
 $stage=Join-Path $OutputRoot "richtext-$cfg"
 $folder=switch($cfg){'Debug'{'gpu-win'} 'Release'{'gpu-win-release'} default{throw 'Unknown Native configuration'}}
 $bin=Join-Path $Repository "native/tests/2d-poc/build/$folder"
 if(Test-Path -LiteralPath $stage){throw "Stage must be new: $stage"}
 New-Item -ItemType Directory -Force $stage | Out-Null
 Get-ChildItem $bin -File | Where-Object {$_.Extension -in '.exe','.dll'} | Copy-Item -Destination $stage
 & robocopy (Join-Path $old 'tools') (Join-Path $stage 'tools') /E /NFL /NDL /NJH /NJS /NP /XD richtext-gpu-native | Out-Null
 if($LASTEXITCODE -gt 7){throw 'tools copy failed'}
 $launcher=Join-Path $stage 'tools/run-graphics-gpu-native.ps1'
 $launcherText=[IO.File]::ReadAllText($launcher)
 $launcherText=[regex]::Replace($launcherText,'(?m)^(\$process=Start-Process[^\r\n]+)','$1'+[Environment]::NewLine+'$nativeProcessHandle = $process.Handle')
 [IO.File]::WriteAllText($launcher,$launcherText,[Text.UTF8Encoding]::new($false))
 $data=Join-Path $stage 'tools/build/richtext-gpu-project/build/windows/data'
 foreach($chunk in $engine.chunks.PSObject.Properties) {
  $target=Join-Path $data "src/cocos-js/$($chunk.Name)"
  New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
  Copy-Item -LiteralPath (Join-Path $EngineDirectory $chunk.Name) -Destination $target
  if((Get-FileHash $target).Hash -ne $chunk.Value){throw 'Candidate Native chunk mismatch'}
 }
 $replaced=0
 Get-ChildItem $data -Recurse -File | Where-Object {$_.Extension -in '.js','.json' -and $_.FullName -notlike '*cocos-js*'} | ForEach-Object {
  $s=[IO.File]::ReadAllText($_.FullName)
  if($s.Contains($old.Replace('\','/'))){[IO.File]::WriteAllText($_.FullName,$s.Replace($old.Replace('\','/'),$stage.Replace('\','/')));$replaced++}
 }
 if(!$replaced){throw 'Expected capture path relocation'}
 $exe=Join-Path $stage 'native-2d-m6-gpu.exe'
 $log=Join-Path $stage 'run.log'
 & node (Join-Path $stage 'tools/run-font-http-native.cjs') --exe $exe --handle-report (Join-Path $stage 'font-handles.json') *> $log
 $code=$LASTEXITCODE
 $deployed=Join-Path $stage 'Resources/src/cocos-js/cc.js'
 if((Get-FileHash $deployed).Hash -ne $engine.chunks.'cc.js'){throw 'Runtime Native chunk was overwritten'}
 $rows+=@{configuration=$cfg;exitCode=$code;engineSha256=(Get-FileHash $deployed).Hash;executableSha256=(Get-FileHash $exe).Hash;log=$log}
 $rows | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $OutputRoot 'richtext-results.json')
 Write-Output "richtext-$cfg=$code"
 if($code -ne 0){throw "Candidate RichText $cfg failed: $code"}
}
exit 0
