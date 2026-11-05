param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
. (Join-Path $PSScriptRoot 'Find-Java.ps1')
if (!(Test-Path -LiteralPath (Join-Path $root 'config.properties'))) {
    Copy-Item -LiteralPath (Join-Path $root 'config.example.properties') -Destination (Join-Path $root 'config.properties')
}
$process = $null
try {
    $java = Find-Java
    $jar = Join-Path $root 'app\smart-email-assistant.jar'
    if (!(Test-Path -LiteralPath $jar)) { throw 'The compiled JAR is missing. Extract the complete ZIP or run BUILD.bat.' }
    $listener = New-Object System.Net.Sockets.TcpClient
    try { $listener.Connect('127.0.0.1',8080); $occupied=$true } catch { $occupied=$false } finally { $listener.Dispose() }
    if ($occupied) { throw 'Port 8080 is in use. Close the other app (or the previous Smartmail window) and retry.' }
    Write-Host ''
    Write-Host 'Starting Smart Email Assistant at http://127.0.0.1:8080' -ForegroundColor Cyan
    Write-Host 'Keep this window open. Press Ctrl+C here to stop the app.'
    Write-Host 'Mode and API key: config.properties. Changes take effect after restart.'
    $process = Start-Process -FilePath $java -ArgumentList '-jar','app\smart-email-assistant.jar' -WorkingDirectory $root -NoNewWindow -PassThru
    $ready=$false
    for($attempt=0;$attempt -lt 60;$attempt++) {
        if($process.HasExited){throw 'The app exited during startup. Read the Java error above.'}
        try { $response=Invoke-RestMethod 'http://127.0.0.1:8080/api/status' -TimeoutSec 1; $ready=$true; break } catch { Start-Sleep -Milliseconds 500 }
    }
    if(!$ready){throw 'Startup timed out. Read the Java error above and check SETUP_GUIDE.html.'}
    if(!$NoBrowser){Start-Process 'http://127.0.0.1:8080'}
    $process.WaitForExit()
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Press Enter to close'
} finally {
    if($process -and !$process.HasExited){Stop-Process -Id $process.Id -ErrorAction SilentlyContinue}
}
