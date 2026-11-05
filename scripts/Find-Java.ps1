function Find-Java {
    $candidates = @()
    if ($env:JAVA_HOME) { $candidates += Join-Path $env:JAVA_HOME 'bin\java.exe' }
    $onPath = Get-Command java.exe -ErrorAction SilentlyContinue
    if ($onPath) { $candidates += $onPath.Source }
    foreach ($folder in @('Java','Eclipse Adoptium','Microsoft','Amazon Corretto')) {
        $base = Join-Path $env:ProgramFiles $folder
        if (Test-Path -LiteralPath $base) {
            $candidates += Get-ChildItem -LiteralPath $base -Directory | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin\java.exe' }
        }
    }
    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (Test-Path -LiteralPath $candidate) {
            $oldPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            $versionText = (& $candidate -version 2>&1 | Out-String)
            $ErrorActionPreference = $oldPreference
            if ($versionText -match 'version "(\d+)') {
                $major = [int]$Matches[1]
                if ($major -ge 17 -and $major -le 27) { return $candidate }
            }
        }
    }
    throw 'Java 17 through 27 was not found. Install a JDK from https://adoptium.net/temurin/releases/ (Java 21 LTS is suitable), then retry. See SETUP_GUIDE.html.'
}
