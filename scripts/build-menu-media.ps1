<#
Maintained asset: reproducible responsive menu-video and poster encoder.
Canonical path: scripts/build-menu-media.ps1.
Future consumer: the next Generations Kitchen site editor replacing or recutting
the featured food footage.
Activation: execute `pwsh -File scripts/build-menu-media.ps1` from the project
root, optionally overriding SourcePath and OutputDirectory.
Behavioral check: `npm test` pins the approved people-frame edit boundaries and
ffprobes the shipped desktop/mobile consumers for native 1728x972 desktop and
native 506x900 mobile (no baked upscale), and complete clip durations; the
script was also executed against the current source to produce the visually
reviewed assets.
Retirement: remove when the site stops consuming responsive raster menu video
or the source footage is replaced by a different production pipeline.
#>

param(
  [string]$SourcePath = (Join-Path (Split-Path -Parent $PSScriptRoot) "work\research\ufc-326-1080p-1h48m-2h02m-video.mp4"),
  [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) "work\full-build-media")
)

$ErrorActionPreference = "Stop"
$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

# Desktop keeps the approved 1728x972 punch-in at native source pixels — do
# not scale it back to 1920x1080. Mobile keeps the approved 506x900 portrait
# window at native source pixels — do not scale it to 1080x1920. CRF 21 is
# the evidence-backed encode against this ~3.2 Mbps source. Do not add
# sharpening or invent detail.
$desktopFilter = "crop=1728:972:96:0,setsar=1"
$mobileFilter = "crop=506:900:707:0,setsar=1"

function Encode-Clip {
  param(
    [string]$Name,
    [double]$Start,
    [double]$Duration,
    [string]$Filter,
    [string]$Suffix
  )

  $target = Join-Path $OutputDirectory "$Name-$Suffix.mp4"
  & ffmpeg -hide_banner -loglevel error -ss $Start -t $Duration -i $SourcePath `
    -vf $Filter -an -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p `
    -movflags +faststart -y $target
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $target" }
}

function Encode-Loco-Montage {
  param(
    [string]$Filter,
    [string]$Suffix
  )

  $target = Join-Path $OutputDirectory "loco-moco-$Suffix.mp4"
  # Start on the blonde guest's reaction, then stay on food. These exact
  # boundaries exclude the two-woman bridge before the patties and the later
  # presenter cut immediately before the eggs.
  $graph = "[0:v]trim=start=7.5:end=9.9,setpts=PTS-STARTPTS,$Filter[a];" +
    "[0:v]trim=start=1.0:end=3.0,setpts=PTS-STARTPTS,$Filter[b];" +
    "[0:v]trim=start=11.8:end=13.8,setpts=PTS-STARTPTS,$Filter[c];" +
    "[a][b][c]concat=n=3:v=1:a=0[out]"

  & ffmpeg -hide_banner -loglevel error -ss 166 -t 15 -i $SourcePath `
    -filter_complex $graph -map "[out]" -an -c:v libx264 -preset slow -crf 21 `
    -pix_fmt yuv420p -movflags +faststart -y $target
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $target" }
}

foreach ($format in @(
  @{ Suffix = "desktop"; Filter = $desktopFilter },
  @{ Suffix = "mobile"; Filter = $mobileFilter }
)) {
  Encode-Clip -Name "hurricane-chicken" -Start 140.0 -Duration 9.8 -Filter $format.Filter -Suffix $format.Suffix
  Encode-Loco-Montage -Filter $format.Filter -Suffix $format.Suffix
  # The source's first 0.2 seconds are a presenter two-shot; begin directly on
  # the lid reveal and preserve the existing clean food endpoint.
  Encode-Clip -Name "poke-bowl" -Start 184.2 -Duration 7.5 -Filter $format.Filter -Suffix $format.Suffix
  Encode-Clip -Name "hurricane-fries" -Start 195.3 -Duration 4.5 -Filter $format.Filter -Suffix $format.Suffix
}

$posters = @(
  @{ Name = "hurricane-chicken"; Time = 6.2 },
  @{ Name = "loco-moco"; Time = 1.3 },
  @{ Name = "poke-bowl"; Time = 1.6 },
  @{ Name = "hurricane-fries"; Time = 1.5 }
)

foreach ($poster in $posters) {
  foreach ($suffix in @("desktop", "mobile")) {
    $inputVideo = Join-Path $OutputDirectory "$($poster.Name)-$suffix.mp4"
    $target = Join-Path $OutputDirectory "$($poster.Name)-$suffix.jpg"
    & ffmpeg -hide_banner -loglevel error -ss $poster.Time -i $inputVideo `
      -frames:v 1 -q:v 2 -y $target
    if ($LASTEXITCODE -ne 0) { throw "poster extraction failed for $target" }
  }
}

Get-ChildItem -LiteralPath $OutputDirectory -File |
  Sort-Object Name |
  Select-Object Name, Length
