$ErrorActionPreference = 'Stop'
$pdvRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
New-Item -ItemType Directory -Force -Path (Join-Path $pdvRoot 'logs') | Out-Null
try {
    $pdvResponse = Invoke-WebRequest 'http://127.0.0.1:8876/' -TimeoutSec 3
    if ($pdvResponse.Content -notmatch 'Pre Delivery Quality Overview') { throw 'Port 8876 is used by another application.' }
} catch {
    if ($_.Exception.Message -like '*another application*') { throw }
    $pdvPython = (Get-Command python).Source
    Start-Process -FilePath $pdvPython -ArgumentList @('serve.py','--port','8876') -WorkingDirectory $pdvRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $pdvRoot 'logs/server.log') -RedirectStandardError (Join-Path $pdvRoot 'logs/server-error.log')
}
Write-Output 'http://127.0.0.1:8876/'
