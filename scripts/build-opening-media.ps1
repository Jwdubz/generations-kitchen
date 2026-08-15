<#
Maintained asset: reproducible native-resolution mobile opening encoder.
Canonical path: scripts/build-opening-media.ps1.
Future consumer: the next Generations Kitchen editor rebuilding
public/media/max-holloway-opening-mobile.mp4.
Activation: execute `pwsh -File scripts/build-opening-media.ps1` from the
project root, optionally overriding SourcePath and OutputDirectory.
Behavioral check: `npm test` ffprobes the shipped mobile opening for 506x900
(no 1080x1920 upscale), 23.5-24.0s, and pins these source trims; desktop
opening is not produced here.
Retirement: remove when the opening carrier is replaced or a different
source-native portrait crop is approved.

Lineage: work/research/ufc-326-1080p-1h48m-2h02m-video.mp4 (1920x1080).
Shipped desktop opening is the brandfree3b clean cut of that source with the
UFC lower-third removed. Mobile is the same approved sequence cropped to
native 506x900 (y=0 stays above the ticker). Do not scale to 1080x1920.
#>

param(
  [string]$SourcePath = (Join-Path (Split-Path -Parent $PSScriptRoot) "work\research\ufc-326-1080p-1h48m-2h02m-video.mp4"),
  [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\media")
)

$ErrorActionPreference = "Stop"
$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$target = Join-Path $OutputDirectory "max-holloway-opening-mobile.mp4"

# Approved sequence: Max walks in, walks behind the two women, food, Max
# eating, clean closing plate. Per-shot X keeps the shipped portrait centers.
$graph = "[0:v]trim=start=207.30:end=218.733,setpts=PTS-STARTPTS,crop=506:900:690:0,setsar=1,fps=30[a];" +
  "[0:v]trim=start=110.80:end=113.000,setpts=PTS-STARTPTS,crop=506:900:564:0,setsar=1,fps=30[b];" +
  "[0:v]trim=start=145.40:end=147.300,setpts=PTS-STARTPTS,crop=506:900:678:0,setsar=1,fps=30[c];" +
  "[0:v]trim=start=218.80:end=220.534,setpts=PTS-STARTPTS,crop=506:900:738:0,setsar=1,fps=30[d];" +
  "[0:v]trim=start=240.20:end=240.800,setpts=PTS-STARTPTS,crop=506:900:666:0,setsar=1,fps=30[e];" +
  "[0:v]trim=start=241.00:end=242.600,setpts=PTS-STARTPTS,crop=506:900:708:0,setsar=1,fps=30[f];" +
  "[0:v]trim=start=275.00:end=276.833,setpts=PTS-STARTPTS,crop=506:900:948:0,setsar=1,fps=30[g];" +
  "[0:v]trim=start=284.40:end=286.700,setpts=PTS-STARTPTS,crop=506:900:714:0,setsar=1,fps=30[h];" +
  "[a][b][c][d][e][f][g][h]concat=n=8:v=1:a=0[out]"

& ffmpeg -hide_banner -loglevel error -i $SourcePath `
  -filter_complex $graph -map "[out]" -an -c:v libx264 -preset slow -crf 21 `
  -pix_fmt yuv420p -r 30 -movflags +faststart -y $target
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $target" }

Get-Item -LiteralPath $target | Select-Object Name, Length
