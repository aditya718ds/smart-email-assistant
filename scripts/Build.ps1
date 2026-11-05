$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
. (Join-Path $PSScriptRoot 'Find-Java.ps1')
$java=Find-Java
$env:JAVA_HOME=Split-Path -Parent (Split-Path -Parent $java)
$env:PATH=(Join-Path $env:JAVA_HOME 'bin')+';'+$env:PATH
if(!(Test-Path (Join-Path $env:JAVA_HOME 'bin\javac.exe'))){throw 'Building requires a full JDK, not only a Java runtime.'}
if(!(Get-Command npm.cmd -ErrorAction SilentlyContinue)){throw 'Install Node.js LTS including npm from https://nodejs.org/ to rebuild the frontend. Normal START.bat use does not require Node.'}
Push-Location (Join-Path $root 'frontend')
try {
    & npm.cmd ci; if($LASTEXITCODE -ne 0){throw 'npm ci failed'}
    & npm.cmd test; if($LASTEXITCODE -ne 0){throw 'Extension tests failed'}
    & npm.cmd run build:extension; if($LASTEXITCODE -ne 0){throw 'Extension build failed'}
    & npm.cmd run build; if($LASTEXITCODE -ne 0){throw 'React build failed'}
} finally {Pop-Location}
$tools=Join-Path $root '.tools'
$maven=Join-Path $tools 'apache-maven-3.9.11\bin\mvn.cmd'
if(!(Test-Path -LiteralPath $maven)) {
    New-Item -ItemType Directory -Force $tools | Out-Null
    $url='https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip'
    $archive=Join-Path $tools 'maven.zip'
    Invoke-WebRequest $url -OutFile $archive -UseBasicParsing
    $checksum=(Invoke-WebRequest ($url+'.sha512') -UseBasicParsing).Content.Trim().Split(' ')[0]
    if((Get-FileHash -LiteralPath $archive -Algorithm SHA512).Hash -ne $checksum){throw 'Maven download checksum mismatch. Retry the build.'}
    Expand-Archive -LiteralPath $archive -DestinationPath $tools -Force
}
& $maven '-Dmaven.repo.local=.tools/m2' -f backend/pom.xml clean verify
if($LASTEXITCODE -ne 0){throw 'Java build or tests failed. Read the errors above.'}
New-Item -ItemType Directory -Force (Join-Path $root 'app') | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'backend\target\smart-email-assistant.jar') -Destination (Join-Path $root 'app\smart-email-assistant.jar') -Force
Write-Host 'Build and tests passed. Run START.bat.' -ForegroundColor Green
