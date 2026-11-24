param([Parameter(Mandatory)][string]$Repository,[Parameter(Mandatory)][string]$PriorDocRoot,
 [Parameter(Mandatory)][string]$EngineDirectory,[Parameter(Mandatory)][string]$OutputRoot,[string[]]$Configurations=@('Debug','Release'))
$ErrorActionPreference='Stop'
$engine=Get-Content -Raw (Join-Path $EngineDirectory 'candidate-engine.json')|ConvertFrom-Json
$rows=@();$probes=Join-Path $OutputRoot 'probes';New-Item -ItemType Directory -Force $probes|Out-Null
Copy-Item (Join-Path $Repository 'native/tests/2d-poc/m2-pixel-golden.json') (Join-Path $probes 'm2-pixel-golden.json')
foreach($name in 'm2-pixel','m3-label','m4-mask','m4-extra','m5-richtext') {
 $source=Join-Path $Repository "native/tests/2d-poc/run-$name-probe.ps1"
 $text=[IO.File]::ReadAllText($source)
 if(!$text.Contains('-WindowStyle')){$text=$text.Replace('Start-Process ','Start-Process -WindowStyle Hidden ')}
 $variable=if($name -eq 'm2-pixel'){'$process'}else{'$proc'}
 $text=[regex]::Replace($text,'(?m)^([^\r\n]+-PassThru[^\r\n]*)(\r?\n)','$1$2'+'$nativeProcessHandle = '+$variable+'.Handle'+[Environment]::NewLine)
 [IO.File]::WriteAllText((Join-Path $probes "run-$name-probe.ps1"),$text,[Text.UTF8Encoding]::new($false))
}
foreach($cfg in $Configurations) {
 $stage=Join-Path $OutputRoot "doc-$cfg"
 if(Test-Path $stage){throw "Stage must be new: $stage"}
 New-Item -ItemType Directory -Force $stage|Out-Null
 Get-ChildItem (Join-Path $PriorDocRoot "doc-build-$cfg") -File|Where-Object {$_.Extension -in '.exe','.dll'}|Copy-Item -Destination $stage
 $res=Join-Path $stage 'Resources'
 & robocopy (Join-Path $PriorDocRoot 'doc-project/build/windows/data') $res /E /NFL /NDL /NJH /NJS /NP|Out-Null
 if($LASTEXITCODE -gt 7){throw 'Document resource copy failed'}
 foreach($chunk in $engine.chunks.PSObject.Properties){
  $dest=Join-Path $res "src/cocos-js/$($chunk.Name)"
  Copy-Item (Join-Path $EngineDirectory $chunk.Name) $dest
  if((Get-FileHash $dest).Hash -ne $chunk.Value){throw 'Native document chunk mismatch'}
 }
 $exe=Join-Path $stage 'cocos-m1-test.exe'
 foreach($name in 'm2-pixel','m3-label','m4-mask','m4-extra','m5-richtext','atlas-stress'){
  $log=Join-Path $OutputRoot "$cfg-$name.log"
  if($name -eq 'atlas-stress'){
   & pwsh -NoProfile -File (Join-Path $Repository 'native/tests/2d-poc/run-m6-static-atlas-stress.ps1') -AppExe $exe -LogDirectory (Join-Path $OutputRoot "$cfg-atlas-stress") *> $log
  }else{
   $flag=if($name -eq 'm2-pixel'){'-Exe'}else{'-AppExe'}
   $opts=@('-NoProfile','-File',(Join-Path $probes "run-$name-probe.ps1"),$flag,$exe)
   if($name -eq 'm5-richtext'){$opts+=@('-LogDirectory',(Join-Path $OutputRoot "$cfg-m5"))}
   & pwsh @opts *> $log
  }
  $code=$LASTEXITCODE
  $rows+=@{configuration=$cfg;stage=$name;exitCode=$code;log=$log;appSha256=(Get-FileHash $exe).Hash;engineSha256=(Get-FileHash (Join-Path $res 'src/cocos-js/cc.js')).Hash}
  $rows|ConvertTo-Json -Depth 6|Set-Content (Join-Path $OutputRoot 'results.json')
  Write-Output "$cfg-$name=$code"
  if($code -ne 0){throw "Document candidate $cfg/$name failed"}
 }
}
exit 0
