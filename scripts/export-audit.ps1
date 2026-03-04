$ErrorActionPreference = "Continue"
$root = (Get-Location).Path

$excludeDirs = @(
    '.git',
    'node_modules',
    '.next',
    'dist',
    'build',
    '.cursor',
    '.vscode'
)

$excludeFiles = @('.env', '.env.local', '.env.development.local', '.env.production.local')

$binaryExt = @('.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.db', '.sqlite')

$files = Get-ChildItem -Path $root -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
    $full = $_.FullName
    $name = $_.Name
    foreach ($dir in $excludeDirs) {
        if ($full -like "*\$dir\*") { return $false }
    }
    foreach ($pat in $excludeFiles) {
        if ($name -eq $pat -or $name -like "$pat*") { return $false }
    }
    if ($binaryExt -contains $_.Extension.ToLower()) { return $false }
    if ($_.Length -gt 1MB) { return $false }
    return $true
}

$out = Join-Path $root "daily-closing-audit.txt"
if (Test-Path $out) { Remove-Item $out -Force }

foreach ($f in $files) {
    if (-not (Test-Path -LiteralPath $f.FullName)) { continue }

    Add-Content -LiteralPath $out "`r`n===================="
    Add-Content -LiteralPath $out $f.FullName
    Add-Content -LiteralPath $out "====================`r`n"

    try {
        Get-Content -LiteralPath $f.FullName -ErrorAction Stop | Add-Content -LiteralPath $out
    } catch {
        Add-Content -LiteralPath $out "[ERROR READING FILE] $($_.Exception.Message)"
    }
}

Write-Host "Export finished -> $out"
