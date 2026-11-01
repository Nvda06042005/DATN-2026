param(
  [ValidateSet('Start','Stop','Status','Install','Uninstall')][string]$Action = 'Status',
  [string]$SourceBranch,
  [switch]$AllowMergeToMain,
  [switch]$FollowCurrentBranch
)
$ErrorActionPreference = 'Stop'
$projectPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$statePath = Join-Path $projectPath '.auto-sync'
$workerPath = Join-Path $PSScriptRoot 'auto-sync.mjs'
$configPath = Join-Path $statePath 'config.json'
$startupPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'DongA-AutoSync.vbs'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $statePath -Force | Out-Null
if ($SourceBranch) {
  if (-not $AllowMergeToMain) { throw 'Pass -AllowMergeToMain only after authorizing automatic merge and deployment.' }
  & git -C $projectPath check-ref-format --branch $SourceBranch | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Invalid source branch' }
  @{ sourceBranch=$SourceBranch; allowMergeToMain=$true; followCurrentBranch=[bool]$FollowCurrentBranch; quietSeconds=120 } |
    ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
}
switch ($Action) {
  'Status' {
    $statusPath = Join-Path $statePath 'status.json'
    if (Test-Path -LiteralPath $statusPath) { Get-Content -LiteralPath $statusPath -Encoding UTF8 } else { 'Not started' }
  }
  'Stop' {
    Set-Content -LiteralPath (Join-Path $statePath 'stop') -Value 'stop' -Encoding ASCII
    'Stop requested. Running checks finish first; no new push will start.'
  }
  'Uninstall' {
    Set-Content -LiteralPath (Join-Path $statePath 'stop') -Value 'stop' -Encoding ASCII
    if (Test-Path -LiteralPath $startupPath) { Remove-Item -LiteralPath $startupPath }
    'Startup entry removed; worker will stop after the current check.'
  }
  'Install' {
    if (-not (Test-Path -LiteralPath $configPath)) { throw 'Specify -SourceBranch and -AllowMergeToMain first' }
    # Only this named, current-user startup file is created. No admin task or credentials.
    $launchLine = '"' + $nodePath + '" "' + $workerPath + '"'
    $vbsText = 'CreateObject("WScript.Shell").Run "' + $launchLine.Replace('"','""') + '", 0, False'
    [IO.File]::WriteAllText($startupPath, $vbsText, [Text.Encoding]::Unicode)
    & $PSCommandPath -Action Start
    "Starts hidden at Windows sign-in: $startupPath"
  }
  'Start' {
    if (-not (Test-Path -LiteralPath $configPath)) { throw 'Specify -SourceBranch and -AllowMergeToMain first' }
    $statusPath = Join-Path $statePath 'status.json'
    if (Test-Path -LiteralPath $statusPath) {
      $workerStatus = Get-Content -LiteralPath $statusPath -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($workerStatus.phase -ne 'stopped' -and $workerStatus.heartbeat -and
          ([DateTime]::UtcNow - [DateTime]::Parse($workerStatus.heartbeat).ToUniversalTime()).TotalSeconds -lt 45) {
        'Worker is already running'; break
      }
    }
    Start-Process -FilePath $nodePath -ArgumentList @(('"' + $workerPath + '"')) -WorkingDirectory $projectPath -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $statePath 'process.out.log') -RedirectStandardError (Join-Path $statePath 'process.err.log') | Out-Null
    'Background worker started. Use -Action Status to inspect its result.'
  }
}
