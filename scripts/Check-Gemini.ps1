$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$settings = @{}
$config = Join-Path $root 'config.properties'
Write-Host 'Smartmail Gemini connection check' -ForegroundColor Cyan
Write-Host ('Project folder: ' + $root)
Write-Host 'Your API key is never printed. A configured key is sent only to Google Gemini.'
if (Test-Path -LiteralPath $config) {
    foreach ($line in Get-Content -LiteralPath $config) {
        if ($line -match '^\s*([^#!][^=]*)=(.*)$') { $settings[$Matches[1].Trim()] = $Matches[2].Trim() }
    }
}
$mode = if ($settings.ContainsKey('assistant.mode')) { $settings['assistant.mode'] } elseif ($env:ASSISTANT_MODE) { $env:ASSISTANT_MODE } else { 'demo' }
$model = if ($settings.ContainsKey('assistant.gemini.model')) { $settings['assistant.gemini.model'] } elseif ($env:GEMINI_MODEL) { $env:GEMINI_MODEL } else { 'gemini-3.8-flash' }
$key = if ($settings.ContainsKey('assistant.gemini.api-key')) { $settings['assistant.gemini.api-key'] } else { $env:GEMINI_API_KEY }
Write-Host ('Mode: ' + $mode)
Write-Host ('Model: ' + $model)
if ($mode -ne 'gemini') { Write-Host 'CONFIG: Set assistant.mode=gemini and restart START.bat to use AI.' -ForegroundColor Yellow }
if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Host 'CONFIG: No API key is set in this copy. Add it to config.properties, without quotes.' -ForegroundColor Yellow
    Write-Host 'A blank key line in config.properties overrides GEMINI_API_KEY from the environment.'
    exit 1
}
if ($key -match '^["'']|["'']$|\s' -or $key -match 'PASTE_YOUR_KEY|YOUR_API_KEY') {
    Write-Host 'CONFIG: The key contains quotes, whitespace, or a placeholder. Enter only the key value.' -ForegroundColor Yellow
    exit 1
}
if ($model -notmatch '^[A-Za-z0-9._-]+$') {
    Write-Host 'CONFIG: Use only the model ID, without a URL or models/ prefix.' -ForegroundColor Yellow
    exit 1
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$headers = @{ 'x-goog-api-key' = $key }
$stage = 'Checking model access'
try {
    Write-Host ($stage + '...')
    $models = @()
    $pageToken = ''
    do {
        $uri = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000'
        if ($pageToken) { $uri += '&pageToken=' + [Uri]::EscapeDataString($pageToken) }
        $page = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 20
        $models += @($page.models)
        $pageToken = $page.nextPageToken
    } while ($pageToken)
    $available = @($models | Where-Object { $_.supportedGenerationMethods -contains 'generateContent' })
    if (!($available | Where-Object { $_.name -eq ('models/' + $model) })) {
        Write-Host 'MODEL: The configured model is not listed as supporting generateContent for this key.' -ForegroundColor Yellow
        Write-Host 'Available text-generation model IDs (choose one and restart the app):'
        $available | Select-Object -First 12 | ForEach-Object { Write-Host ('  ' + ($_.name -replace '^models/', '')) }
        exit 1
    }
    $stage = 'Testing a minimal generation request'
    Write-Host ($stage + ' (this uses a small API request)...')
    $body = @{ contents = @(@{ parts = @(@{ text = 'Reply with the single word OK.' }) }) } | ConvertTo-Json -Depth 8
    $result = Invoke-RestMethod -Uri ('https://generativelanguage.googleapis.com/v1beta/models/' + $model + ':generateContent') -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 55
    $textParts = @($result.candidates | ForEach-Object { $_.content.parts } | Where-Object { $_.text -and !$_.thought })
    if ($textParts.Count -eq 0) {
        Write-Host 'RESPONSE: Google returned no text. This is not a connection failure; review model restrictions or content feedback.' -ForegroundColor Yellow
        exit 1
    }
    Write-Host 'PASS: This key and model successfully generated text through Google Gemini.' -ForegroundColor Green
    if ($mode -eq 'gemini') { Write-Host 'If the app still fails, restart START.bat from this same folder and report the app error.' }
    else { Write-Host 'Set assistant.mode=gemini, save config.properties, then restart START.bat from this folder.' }
} catch {
    $response = $_.Exception.Response
    $code = if ($response) { [int]$response.StatusCode } else { 0 }
    $providerStatus = ''
    $reason = ''
    try {
        $raw = $_.ErrorDetails.Message
        if (!$raw -and $response) {
            $stream = $response.GetResponseStream()
            if ($stream) { $reader = New-Object IO.StreamReader($stream); $raw = $reader.ReadToEnd(); $reader.Dispose() }
        }
        $details = $raw | ConvertFrom-Json
        if ($details.error.status -match '^[A-Z0-9_]+$') { $providerStatus = $details.error.status }
        foreach ($item in @($details.error.details)) { if ($item.reason -match '^[A-Z0-9_]+$') { $reason = $item.reason; break } }
    } catch { }
    Write-Host ('FAILED during: ' + $stage) -ForegroundColor Red
    Write-Host ('HTTP: ' + $code + '  Google status: ' + $providerStatus + '  Reason: ' + $reason)
    switch ($code) {
        400 { Write-Host 'Check the key value and model/API compatibility. Google rejected the request.' }
        401 { Write-Host 'Google did not accept the API credentials.' }
        402 { Write-Host 'Google requires billing or credits for this project. Review AI Studio billing.' }
        403 { Write-Host 'Check API-key restrictions, blocked/leaked-key notices, project access and region in AI Studio.' }
        404 { Write-Host 'This model is unavailable for the requested API. Choose an available model ID.' }
        429 { Write-Host 'Quota or rate limit reached. Check the project quota in AI Studio; a new key in the same project may not help.' }
        503 { Write-Host 'Google is temporarily unavailable. Retry later.' }
        default { Write-Host 'Check DNS, internet connectivity, Java/proxy settings, firewall and the reported HTTP status. HTTP 0 means no HTTP response was received.' }
    }
    Write-Host 'Share the FAILED/HTTP/status/reason lines for diagnosis. Do not share the API key.'
    exit 1
}
