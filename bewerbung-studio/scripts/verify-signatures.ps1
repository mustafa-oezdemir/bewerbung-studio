param(
  [Parameter(Mandatory = $true)]
  [string]$ReleaseDirectory
)

$resolvedDirectory = Resolve-Path -LiteralPath $ReleaseDirectory
$executables = Get-ChildItem -LiteralPath $resolvedDirectory -Filter '*.exe'

if ($executables.Count -lt 2) {
  throw 'Setup- und Portable-EXE wurden nicht gefunden.'
}

foreach ($executable in $executables) {
  $signature = Get-AuthenticodeSignature -LiteralPath $executable.FullName
  if ($signature.Status -ne 'Valid') {
    throw "$($executable.Name) besitzt keine gültige Authenticode-Signatur: $($signature.Status)"
  }
  if (-not $signature.TimeStamperCertificate) {
    throw "$($executable.Name) besitzt keinen vertrauenswürdigen Zeitstempel."
  }
  Write-Host "$($executable.Name): gültig signiert und zeitgestempelt."
}
