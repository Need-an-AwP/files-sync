# Parameter Definition
param(
    [Parameter(Mandatory = $true)]
    [string]$sourceDir,
    [Parameter(Mandatory = $true)]
    [string]$baseDestination,
    [switch]$FullCopy = $false
)

# Set environment variable to force English output
$env:LANG = "en_US.UTF-8"

# Validate paths
if (-not $sourceDir) {
    Write-Host "Error: Source directory path is required." -ForegroundColor Red
    exit 1
}

if (-not $baseDestination) {
    Write-Host "Error: Base destination path is required." -ForegroundColor Red
    exit 1
}

# Get source folder name
$sourceName = Split-Path $sourceDir -Leaf

# Set destination path
$destinationPath = Join-Path $baseDestination $sourceName

# Ensure paths exist
if (-not (Test-Path -Path $sourceDir)) {
    Write-Host "Error: Source directory does not exist: $sourceDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -Path $baseDestination)) {
    Write-Host "Error: Base destination path does not exist: $baseDestination" -ForegroundColor Red
    exit 1
}

try {
    if (-not (Test-Path -Path $destinationPath)) {
        Write-Host "Creating destination directory: $destinationPath" -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $destinationPath -Force
    }
}
catch {
    Write-Host "Error: Failed to create destination directory: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Starting file synchronization..." -ForegroundColor Yellow
Write-Host "From: $sourceDir" -ForegroundColor Cyan
Write-Host "To: $destinationPath" -ForegroundColor Cyan
Write-Host "Full Copy Mode: $FullCopy" -ForegroundColor Cyan

# Set robocopy parameters
$robocopyArgs = @(
    "`"$sourceDir`"",
    "`"$destinationPath`"",
    "/MIR",  # Mirror directory tree
    #"/NP",  # Don't show progress
    "/NFL",  # Don't log file names
    "/NDL",  # Don't log directory names
    "/MT:16" # Use 16 threads
)

# Add parameters based on whether full copy is enabled
if (-not $FullCopy) {
    $robocopyArgs += "/XD"
    $robocopyArgs += "`"$sourceDir\release`""
    $robocopyArgs += "`"$sourceDir\node_modules`""
    $robocopyArgs += "`"$sourceDir\dist`""
    $robocopyArgs += "`"$sourceDir\.git`""
}
else {
    $robocopyArgs += "/XD"
    $robocopyArgs += "`"$sourceDir\.git`""
}

try {
    # Execute robocopy command
    $robocopyCommand = "robocopy " + ($robocopyArgs -join " ")
    Write-Host "Executing command: $robocopyCommand" -ForegroundColor Gray
    Invoke-Expression $robocopyCommand

    # Check robocopy return value
    $exitCode = $LASTEXITCODE
    switch ($exitCode) {
        0 { Write-Host "Success: No files were copied." -ForegroundColor Green }
        1 { Write-Host "Success: Files were copied successfully." -ForegroundColor Green }
        2 { Write-Host "Success: Extra files or directories were detected." -ForegroundColor Green }
        3 { Write-Host "Success: Files were copied and extra files were detected." -ForegroundColor Green }
        default { 
            Write-Host "Error occurred during synchronization. Error code: $exitCode" -ForegroundColor Red 
            exit $exitCode
        }
    }
}
catch {
    Write-Host "Error executing robocopy: $_" -ForegroundColor Red
    exit 1
}
