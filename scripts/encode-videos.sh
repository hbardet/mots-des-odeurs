#!/bin/bash
# Normalise les clips du mur vidéo : 1800×1200 (3:2), H.264 High, 30 fps, muet,
# yuv420p BT.709 TV-range, faststart.
#
# Les masters ne sont pas dans ce repo (148 Mo). Par défaut ils sont lus dans
# ../julieSite-masters ; surcharge avec MASTERS=/chemin/vers/les/masters.
#
#   ./scripts/encode-videos.sh          # ré-encode les 10 clips
#   ./scripts/encode-videos.sh 03-cafe  # ré-encode seulement ce slug
#
# Les fichiers produits sont video/NN-slug.mp4, référencés par data.js.
set -euo pipefail

cd "$(dirname "$0")/.."
MASTERS="${MASTERS:-../julieSite-masters}"
OUT="video"

VF="fps=30,scale=1800:1200:force_original_aspect_ratio=increase:flags=lanczos,crop=1800:1200,setsar=1,format=yuv420p"
# ventilateur.mov est en full-range : on convertit explicitement vers TV-range.
VF_FULL="fps=30,scale=1800:1200:force_original_aspect_ratio=increase:flags=lanczos:in_range=full:out_range=tv,crop=1800:1200,setsar=1,format=yuv420p"
X264="aq-mode=3:aq-strength=1.1:psy-rd=1.0,0.25:deblock=-1,-1"

# slug|master|filtre
CLIPS=(
  "01-baie-vitree|Baie vitrée.mp4|"
  "02-bulle|bulle.mp4|"
  "03-cafe|café.mp4|"
  "04-essence|Essence.mp4|"
  "05-fleur|fleur.mov|"
  "06-fumee|fumée.mp4|"
  "07-lumiere|lumière.mp4|"
  "08-poubelle|Poubelle.mp4|"
  "09-ventilateur|ventilateur.mov|full"
  "10-ordinateur|ordianteur.GIF|"
)

wanted=("$@")
for entry in "${CLIPS[@]}"; do
  IFS='|' read -r slug master mode <<<"$entry"
  if [ ${#wanted[@]} -gt 0 ]; then
    keep=0
    for w in "${wanted[@]}"; do [ "$w" = "$slug" ] && keep=1; done
    [ $keep -eq 1 ] || continue
  fi
  src="$MASTERS/$master"
  [ -f "$src" ] || { echo "master manquant : $src" >&2; exit 1; }
  vf="$VF"; [ -n "${mode:-}" ] && vf="$VF_FULL"
  echo "--> $master  =>  $OUT/$slug.mp4"
  ffmpeg -v error -y -i "$src" -vf "$vf" \
    -c:v libx264 -preset veryslow -crf 15 -tune film -x264-params "$X264" \
    -profile:v high -level 4.0 -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -movflags +faststart -an -map_metadata -1 "$OUT/$slug.mp4"
  printf '%8s  %s bps\n' "$(du -h "$OUT/$slug.mp4" | cut -f1)" \
    "$(ffprobe -v error -show_entries format=bit_rate -of default=nw=1:nk=1 "$OUT/$slug.mp4")"
done
