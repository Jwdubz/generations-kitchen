<#
Maintained asset: ships the highest-fidelity opening on mobile by copying
the desktop 1920x1080 encode. Canonical path:
scripts/build-opening-media.ps1.
Future consumer: the next Generations Kitchen editor rebuilding
public/media/max-holloway-opening-mobile.mp4.
Activation: execute `pwsh -File scripts/build-opening-media.ps1` from the
project root, optionally overriding OutputDirectory.
Behavioral check: `npm test` ffprobes both openings for 1920x1080,
23.5-24.0s, and pins the approved source trims documented below.
Retirement: remove when the opening carrier is replaced.

Lineage: work/research/ufc-326-1080p-1h48m-2h02m-video.mp4 (1920x1080).
Shipped desktop opening is the brandfree3b clean cut of that source with the
UFC lower-third removed. Mobile now uses that same file so the first beat
keeps the full native frame. Do not scale to 1080x1920.

Approved sequence (already cut into the desktop encode):
trim=start=207.30:end=218.733
trim=start=110.80:end=113.000
trim=start=145.40:end=147.300
trim=start=218.80:end=220.534
trim=start=240.20:end=240.800
trim=start=241.00:end=242.600
trim=start=275.00:end=276.833
trim=start=284.40:end=286.700
#>

param(
  [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\media")
)

$ErrorActionPreference = "Stop"
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$desktop = Join-Path $OutputDirectory "max-holloway-opening-desktop.mp4"
$target = Join-Path $OutputDirectory "max-holloway-opening-mobile.mp4"

if (-not (Test-Path -LiteralPath $desktop)) {
  throw "Desktop opening is missing: $desktop"
}

Copy-Item -LiteralPath $desktop -Destination $target -Force
Get-Item -LiteralPath $target | Select-Object Name, Length
