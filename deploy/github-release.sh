#!/usr/bin/env bash
# Run over SSH by GitHub Actions. Credentials and persistent volumes stay on the server.
set -Eeuo pipefail
umask 077
sha="${1:-}"
digest="${2:-}"
[[ "$sha" =~ ^[a-f0-9]{40,64}$ && "$digest" =~ ^[a-f0-9]{64}$ ]] || { echo 'Ungueltige Release-ID.' >&2; exit 1; }
root=/opt/miteinander
archive="/tmp/miteinander-${sha}.tar.gz"
release="$root/releases/$sha"
test -f "$root/.env.production" || { echo 'Zuerst /opt/miteinander/.env.production auf dem Server einrichten.' >&2; exit 1; }
command -v docker >/dev/null
docker compose version >/dev/null
command -v flock >/dev/null
mkdir -p "$root/releases"
exec 9>"$root/.deployment.lock"
flock -n 9 || { echo 'Eine andere Veroeffentlichung laeuft bereits.' >&2; exit 1; }
printf '%s  %s\n' "$digest" "$archive" | sha256sum --check --status

# Never take over ports already used by another Docker project.
while read -r container; do
  test -n "$container" || continue
  project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container")"
  [[ "$project" == miteinander ]] || { echo 'Port 80/443 wird von einem anderen Docker-Projekt verwendet.' >&2; exit 1; }
done < <(docker ps --filter publish=80 --filter publish=443 --format '{{.ID}}')

if [[ ! -d "$release" ]]; then
  # Refuse absolute paths, parent traversal and accidental runtime-data uploads.
  while IFS= read -r entry; do
    case "$entry" in
      /*|../*|*/../*|.git/*|data/*|backups/*|node_modules/*|.env|.env.production|.env.local)
        echo 'Das Archiv enthaelt nicht erlaubte Dateien.' >&2; exit 1 ;;
    esac
  done < <(tar -tzf "$archive")
  stage="$(mktemp -d "$root/releases/.${sha}.XXXXXX")"
  tar -xzf "$archive" --no-same-owner -C "$stage"
  for file in compose.yaml Dockerfile server.mjs scripts/backup.mjs; do test -f "$stage/$file" || { echo 'Release ist unvollstaendig.' >&2; exit 1; }; done
  ln -s "$root/.env.production" "$stage/.env.production"
  printf '%s\n' "$sha" > "$stage/.release-sha"
  mv "$stage" "$release"
fi
[[ "$(cat "$release/.release-sha")" == "$sha" ]] || { echo 'Release-Identitaet stimmt nicht.' >&2; exit 1; }
compose=(docker compose --project-directory "$release" --env-file "$root/.env.production")
"${compose[@]}" config --quiet
previous=''
if [[ -L "$root/current" ]]; then
  previous="$(readlink -f "$root/current")"
  [[ "$previous" == "$root/releases/"* && -f "$previous/compose.yaml" ]] || { echo 'Unerwarteter vorheriger Release-Pfad.' >&2; exit 1; }
fi

rollback() {
  result=$?
  trap - ERR
  if [[ -n "$previous" && "$previous" != "$release" ]]; then
    echo 'Neue Version fehlgeschlagen. Vorherige Version wird gestartet.' >&2
    docker compose --project-directory "$previous" --env-file "$root/.env.production" up -d --build --wait --wait-timeout 180 || true
  fi
  echo 'Daten- und Sicherungsvolumes wurden nicht entfernt.' >&2
  exit "$result"
}

# A running instance can be backed up before rebuilding the image.
if [[ -n "$("${compose[@]}" ps --status running -q app)" ]]; then
  "${compose[@]}" exec -T app node scripts/backup.mjs
fi
trap rollback ERR
"${compose[@]}" up -d --build --wait --wait-timeout 180
"${compose[@]}" exec -T app node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ln -sfn "$release" "$root/.current-next"
mv -Tf "$root/.current-next" "$root/current"
trap - ERR
echo "Release $sha ist aktiv."
