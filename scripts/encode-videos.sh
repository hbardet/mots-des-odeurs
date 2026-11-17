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
#
# Contrainte d'hébergement : Cloudflare Pages refuse tout fichier de plus de
# 25 MiB ("Pages only supports files up to 25 MiB in size"). CRF 15 suffit pour
# neuf clips ; 03-cafe (mousse de lait, grain très fin) dépassait à 49 MiB, il
# est donc encodé en deux passes à débit cible. Le script échoue si un fichier
# produit franchit la limite.
set -euo pipefail

cd "$(dirname "$0")/.."
MASTERS="${MASTERS:-../julieSite-masters}"
OUT="video"
LIMIT_MIB=25

VF="fps=30,scale=1800:1200:force_original_aspect_ratio=increase:flags=lanczos,crop=1800:1200,setsar=1,format=yuv420p"
# ventilateur.mov est en full-range : on convertit explicitement vers TV-range.
VF_FULL="fps=30,scale=1800:1200:force_original_aspect_ratio=increase:flags=lanczos:in_range=full:out_range=tv,crop=1800:1200,setsar=1,format=yuv420p"
X264="aq-mode=3:aq-strength=1.1:psy-rd=1.0,0.25:deblock=-1,-1"

# slug|master|filtre|débit cible (vide = CRF 15)
CLIPS=(
  "01-baie-vitree|Baie vitrée.mp4||"
  "02-bulle|bulle.mp4||"
  "03-cafe|café.mp4||8600k"
  "04-essence|Essence.mp4||"
  "05-fleur|fleur.mov||"
  "06-fumee|fumée.mp4||"
  "07-lumiere|lumière.mp4||"
  "08-poubelle|Poubelle.mp4||"
  "09-ventilateur|ventilateur.mov|full|"
  "10-ordinateur|ordinateur.mp4||"
)

encode() { # $1 master, $2 filtre 3:2, $3 débit cible ("" = CRF), $4 sortie
  local src="$1" vf="$2" rate="$3" dst="$4"
  local common=(-vf "$vf" -c:v libx264 -preset veryslow -tune film
                -x264-params "$X264" -profile:v high -level 4.0 -pix_fmt yuv420p
                -color_primaries bt709 -color_trc bt709 -colorspace bt709
                -movflags +faststart -an -map_metadata -1)

  if [ -z "$rate" ]; then
    ffmpeg -v error -y -i "$src" "${common[@]}" -crf 15 "$dst"
    return
  fi

  # Deux passes à débit cible : la taille est garantie, la qualité se répartit
  # toute seule sur les passages faciles.
  local log maxrate bufsize
  log="$(mktemp -t x264pass)"
  maxrate=$(( ${rate%k} * 112 / 100 ))k
  bufsize=$(( ${rate%k} * 2 ))k
  ffmpeg -v error -y -i "$src" "${common[@]}" -b:v "$rate" -maxrate "$maxrate" \
    -bufsize "$bufsize" -pass 1 -passlogfile "$log" -f mp4 /dev/null
  ffmpeg -v error -y -i "$src" "${common[@]}" -b:v "$rate" -maxrate "$maxrate" \
    -bufsize "$bufsize" -pass 2 -passlogfile "$log" "$dst"
  rm -f "$log" "$log".*
}

wanted=("$@")
for entry in "${CLIPS[@]}"; do
  IFS='|' read -r slug master mode rate <<<"$entry"
  if [ ${#wanted[@]} -gt 0 ]; then
    keep=0
    for w in "${wanted[@]}"; do [ "$w" = "$slug" ] && keep=1; done
    [ $keep -eq 1 ] || continue
  fi
  src="$MASTERS/$master"
  [ -f "$src" ] || { echo "master manquant : $src" >&2; exit 1; }
  vf="$VF"; [ -n "${mode:-}" ] && vf="$VF_FULL"
  echo "--> $master  =>  $OUT/$slug.mp4${rate:+ ($rate)}"
  encode "$src" "$vf" "${rate:-}" "$OUT/$slug.mp4"
done

status=0
for f in "$OUT"/*.mp4; do
  # GNU stat d'abord (Linux, machine de build), BSD ensuite (macOS).
  bytes=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")
  mib=$(echo "scale=2; $bytes/1048576" | bc)
  printf '%7.2f MiB  %s\n' "$mib" "$f"
  if [ "$(echo "$mib > $LIMIT_MIB" | bc)" -eq 1 ]; then
    echo "  ^ dépasse la limite de ${LIMIT_MIB} MiB de Cloudflare Pages" >&2
    status=1
  fi
done
exit $status
