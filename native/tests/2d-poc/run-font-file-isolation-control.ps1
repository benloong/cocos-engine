# Diagnostic directory comparison; its reports do not replace the native font gate.
param([Parameter(Mandatory)][string]$Repository,[Parameter(Mandatory)][string]$OutputRoot)
$ErrorActionPreference='Stop'
$Repository=[IO.Path]::GetFullPath($Repository)
$OutputRoot=[IO.Path]::GetFullPath($OutputRoot)
if(!(Test-Path -LiteralPath (Join-Path $Repository 'tests/fixtures/Thonburi.ttf'))){throw 'Font fixture not found'}
New-Item -ItemType Directory -Force $OutputRoot | Out-Null
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Threading;
using System.Runtime.InteropServices;
public static class M6RawFileControl {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CopyFile(string a,string b,bool fail);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateFile(string path,uint access,uint sharing,IntPtr sa,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr h);
 public static string Run(string fixture,string target) {
  for(int i=1;i<=1000;i++) {
   if(!CopyFile(fixture,target,false))return "copy cycle="+i+" error="+Marshal.GetLastWin32Error();
   Thread.Sleep(10);
   IntPtr h=CreateFile(target,0xC0000000,0,IntPtr.Zero,3,0x80,IntPtr.Zero);
   if(h==new IntPtr(-1))return "exclusive-open cycle="+i+" error="+Marshal.GetLastWin32Error();
   if(!CloseHandle(h))return "close cycle="+i+" error="+Marshal.GetLastWin32Error();
  }
  return "PASS 1000 raw-copy-close-exclusive-open cycles; no engine or DirectWrite API calls";
 }
}
"@
$rows=@()
foreach($context in @('workspace','isolated','system-temp')) {
 $directory=switch($context){'workspace'{$Repository} 'isolated'{Join-Path $OutputRoot 'raw-control-isolated'} 'system-temp'{Join-Path ([IO.Path]::GetTempPath()) 'm6-font-source-control'}}
 New-Item -ItemType Directory -Force $directory | Out-Null
 $target=Join-Path $directory ('m6f-raw-'+[guid]::NewGuid().ToString('N')+'.tmp')
 try {$result=[M6RawFileControl]::Run((Join-Path $Repository 'tests/fixtures/Thonburi.ttf'),$target)} finally {if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target}}
 $rows+=@{context=$context;result=$result;target=$target;engineApiUsed=$false;directWriteApiUsed=$false}
 $rows | ConvertTo-Json | Set-Content (Join-Path $OutputRoot 'raw-file-control-results.json')
 Write-Output "$context $result"
}