param([ValidateSet('Install','Uninstall','Status')][string]$Action='Install')
$ErrorActionPreference='Stop'
$addinId='bc75b058-92b8-4dd1-84fb-8792db3f7e72'
$source='https://datn-2026-indol.vercel.app/office-calendar/index.html'
$registryPath='Software\Microsoft\Office\16.0\Wef\Developer'
$installDir=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'DongAEdu\ExcelCalendar'
$installedManifest=Join-Path $installDir 'manifest.xml'
# Equivalent to Microsoft's office-addin-dev-settings register, scoped to this ID.
# Never changes macro policy, Protected View, trusted folders, debugging, or TLS.
if($Action -eq 'Status'){
  $key=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($registryPath)
  try{$value=if($key){$key.GetValue($addinId)}else{$null};if($value -eq $installedManifest -and (Test-Path -LiteralPath $installedManifest)){'Dong A calendar is registered for this Windows user.'}else{'Dong A calendar is not registered.'}}finally{if($key){$key.Dispose()}}
  exit
}
if($Action -eq 'Uninstall'){
  $key=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($registryPath,$true)
  try{if($key){$key.DeleteValue($addinId,$false)}}finally{if($key){$key.Dispose()}}
  'Dong A calendar registration removed. Your workbooks and data are unchanged.'
  exit
}
$inputManifest=Join-Path $PSScriptRoot 'manifest.xml'
if(-not(Test-Path -LiteralPath $inputManifest)){throw 'Extract the ZIP first. manifest.xml must be next to this script.'}
[xml]$manifest=Get-Content -LiteralPath $inputManifest -Raw -Encoding UTF8
$manager=[Xml.XmlNamespaceManager]::new($manifest.NameTable)
$manager.AddNamespace('o','http://schemas.microsoft.com/office/appforoffice/1.1')
$idNode=$manifest.SelectSingleNode('/o:OfficeApp/o:Id',$manager)
$sourceNode=$manifest.SelectSingleNode('/o:OfficeApp/o:DefaultSettings/o:SourceLocation',$manager)
$permissionNode=$manifest.SelectSingleNode('/o:OfficeApp/o:Permissions',$manager)
if(-not $idNode -or $idNode.InnerText -ne $addinId -or -not $sourceNode -or $sourceNode.DefaultValue -ne $source -or -not $permissionNode -or $permissionNode.InnerText -ne 'ReadWriteDocument'){throw 'Unexpected manifest. Download the Dong A calendar package again from your school portal.'}
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Copy-Item -LiteralPath $inputManifest -Destination $installedManifest -Force
$key=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($registryPath)
try{$key.SetValue($addinId,$installedManifest,[Microsoft.Win32.RegistryValueKind]::String)}finally{$key.Dispose()}
'Dong A calendar installed for this Windows user. Save your work, then close and reopen Microsoft Excel when ready.'
'Open a NEW Dong A teacher/student .xlsx template. Keep Internet available and accept the normal Office add-in permission prompt if you agree.'
