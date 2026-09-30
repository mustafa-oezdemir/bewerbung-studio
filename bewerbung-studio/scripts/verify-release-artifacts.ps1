param(
  [Parameter(Mandatory = $true)]
  [string]$Version,
  [string]$ReleaseDirectory = 'windows-release'
)

# Checks the files of one release: the expected names for this version exist and are not empty, the checksum
# file lists exactly them, every checksum is recomputed from the real file, and no key material is among them.
$ErrorActionPreference = 'Stop'
$directory = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
$expected = @(
  "BewerbungsManager-$Version-x64-Setup.exe",
  "BewerbungsManager-$Version-x64-Portable.exe"
)

foreach ($name in $expected + 'SHA256SUMS.txt') {
  $path = Join-Path $directory $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Release-Artefakt fehlt: $name" }
  if ((Get-Item -LiteralPath $path).Length -le 0) { throw "Release-Artefakt ist leer: $name" }
}

$listed = @{}
foreach ($line in Get-Content -LiteralPath (Join-Path $directory 'SHA256SUMS.txt')) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  if ($line -notmatch '^(?<hash>[0-9a-fA-F]{64})\s+\*?(?<name>.+)$') { throw "Ungültige Zeile in SHA256SUMS.txt: $line" }
  $listed[$Matches['name']] = $Matches['hash'].ToLowerInvariant()
}
$unexpected = $listed.Keys | Where-Object { $expected -notcontains $_ }
if ($unexpected) { throw "SHA256SUMS.txt enthält nicht erwartete Dateien: $($unexpected -join ', ')" }
foreach ($name in $expected) {
  if (-not $listed.ContainsKey($name)) { throw "SHA256SUMS.txt enthält keine Prüfsumme für $name" }
  $actual = (Get-FileHash -LiteralPath (Join-Path $directory $name) -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $listed[$name]) { throw "Prüfsumme stimmt nicht: $name (erwartet $($listed[$name]), berechnet $actual)" }
  Write-Host "${name}: SHA-256 stimmt ($actual)"
}

$keyMaterial = Get-ChildItem -LiteralPath $directory -Recurse -File |
  Where-Object { $_.Extension -in '.pfx', '.p12', '.pem', '.key', '.cer', '.crt' }
if ($keyMaterial) { throw "Zertifikats- oder Schlüsseldateien im Release-Ordner: $($keyMaterial.Name -join ', ')" }
Write-Host "Release-Artefakte für Version $Version sind vollständig und geprüft."
