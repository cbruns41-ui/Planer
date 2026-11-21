# Betrieb auf Hetzner Cloud

## Verbindung mit GitHub

Das vorgesehene Repository ist [cbruns41-ui/Planer](https://github.com/cbruns41-ui/Planer). GitHub Actions prüft Änderungen auf `main` und Pull Requests: Tests, Deployment-Syntax, Compose-Konfiguration, Docker-Build, Containerstart und Datenbanksicherung mit schreibgeschütztem Quelldaten-Volume.

Die Veröffentlichung auf Hetzner wird nach erfolgreicher Prüfung ausgeführt, sobald die Repository-Variable `DEPLOY_ENABLED=true` gesetzt ist. Bis dahin werden nur Prüfungen ausgeführt. GitHub erhält weder die Produktivdatenbank noch `.env.production`. Der Quellcode wird als Git-Archiv über eine SSH-Verbindung mit geprüftem Hostschlüssel übertragen.

Unter **Settings → Secrets and variables → Actions** diese Secrets hinterlegen:

| Secret | Wert |
| --- | --- |
| `HETZNER_HOST` | IP-Adresse oder Hostname des vorgesehenen Servers |
| `HETZNER_USER` | SSH-Nutzer mit Zugriff auf `/opt/miteinander` und Docker |
| `HETZNER_SSH_KEY` | Privater, nur für dieses Deployment eingerichteter SSH-Schlüssel |
| `HETZNER_KNOWN_HOSTS` | Bekannter SSH-Hostschlüssel des Servers; Fingerabdruck zuvor unabhängig am Server prüfen |

Repository-Variablen:

| Variable | Wert |
| --- | --- |
| `PRODUCTION_URL` | `https://kalender.deine-domain.de` |
| `HETZNER_SSH_PORT` | Optional, Standard `22` |
| `DEPLOY_ENABLED` | Erst nach Servereinrichtung auf `true` setzen |

Auf dem Server müssen Docker, Compose und `/opt/miteinander/.env.production` vorhanden sein. Die Konfiguration nach der unten beschriebenen Einrichtung erzeugen. Der öffentliche Teil des Deployment-Schlüssels muss beim vorgesehenen SSH-Nutzer hinterlegt sein. Ein dedizierter Schlüssel verhindert die Weitergabe eines persönlichen SSH-Schlüssels an GitHub.

Die Pipeline legt pro Commit einen Ordner unter `/opt/miteinander/releases/COMMIT` an. Produktive Daten bleiben in den festen Docker-Volumes. Vor Updates einer laufenden App wird eine Sicherung erstellt. Bei erfolgreichem Start zeigt `/opt/miteinander/current` auf die neue Version. Scheitert ein späteres Release, wird die vorherige Codeversion erneut gestartet; die Datenbank wird dabei nicht automatisch auf einen älteren Stand zurückgesetzt. Die Pipeline übernimmt keine bereits von einem anderen Docker-Projekt belegten Web-Ports.

Die letzte Prüfung ruft die öffentliche HTTPS-Gesundheitsadresse auf. Sichtbare Deployments und ihre Ergebnisse stehen unter **Actions** im Repository. Die Einrichtung nutzt [GitHub-Deployment-Environments](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/deploy-to-environment).

Die Anwendung ist für einen einzelnen Hetzner-Server mit Docker Engine und Compose vorbereitet. Sie wird hierdurch noch nicht automatisch auf einem Server veröffentlicht. Benötigt werden Serverzugang, eine Domain und optional ein SMTP-Konto.

## Was zentral gespeichert wird

Konten, Passwort-Hashes, E-Mail-Adressen, Sitzungen, Personen, Termine, Geburtstage, Essensplan, Einkaufsliste und Wetterort liegen in einer SQLite-Datenbank im Docker-Volume `miteinander_app_data`. Alle Geräte verwenden dieselbe HTTPS-Adresse und damit dieselben Daten. Kalender verschiedener Haushalte bleiben getrennt. Im Browser wird nur die Stellung des Seitenmenüs gespeichert; Fachdaten werden nicht in localStorage geschrieben und API-Antworten nicht im Offline-Cache abgelegt.

Ein Server und eine App-Instanz sind vorgesehen. Mehrere App-Replikate mit jeweils eigener SQLite-Datei würden unterschiedliche Datenstände erzeugen und sind in dieser Konfiguration nicht vorgesehen.

## Server vorbereiten

1. Einen Linux-Server mit Ubuntu 24.04 LTS und SSH-Schlüssel einrichten. Docker Engine und das Compose-Plugin nach der [offiziellen Docker-Anleitung](https://docs.docker.com/engine/install/ubuntu/) installieren. Alternativ die mitgelieferte `cloud-init.yaml` beim Erstellen eines **neuen** Servers als User Data verwenden; sie installiert Docker, veröffentlicht aber noch keine App.
2. In der Hetzner-Firewall eingehend TCP 80 und 443 erlauben, optional UDP 443. SSH/TCP 22 für die eigene Admin-Adresse freigeben. Port 3100 wird nicht veröffentlicht; nur Caddy erreicht die App über das interne Docker-Netz.
3. Einen DNS-A-Record der gewünschten Domain auf die IPv4-Adresse des Servers setzen. Einen AAAA-Record nur setzen, wenn IPv6 auf diesem Server tatsächlich erreichbar ist.
4. Den Projektordner mit `Dockerfile`, `compose.yaml`, `package-lock.json`, `server.mjs`, `mail.mjs`, `public/`, `scripts/` und `deploy/` nach `/opt/miteinander` kopieren. Lokale Ordner `node_modules`, `data`, `tmp` und private `.env`-Dateien nicht als Quellcode übertragen. Bestehende Daten werden über eine Sicherung übernommen, siehe unten.

Die automatische Zertifikatsausstellung verwendet Caddys [Automatic HTTPS](https://caddyserver.com/docs/automatic-https). Domain und freigegebene Ports müssen erreichbar sein.

## Konfiguration und erster Start

Die folgenden Befehle im Projektordner `/opt/miteinander` ausführen. Beispiel-Domain und E-Mail ersetzen:

```sh
docker run --rm -v "$PWD:/project" -w /project node:24-bookworm-slim \
  node scripts/configure-production.mjs \
  --domain kalender.deine-domain.de --email du@deine-domain.de
```

Dadurch entsteht `.env.production` mit Dateirechten 600. Eine vorhandene Datei wird nicht überschrieben. Der Nutzername bleibt **Bruns**. Für eine neue Produktivdatenbank wird ein zufälliges Startpasswort erzeugt und ausschließlich in `.env.production` unter `SEED_PASSWORD` gespeichert. Lokal bleibt der ursprüngliche Zugang `Bruns / Test1234` unverändert. Wird eine bestehende Datenbank übernommen, bleiben deren Konten und Passwörter erhalten.

Für den E-Mail-Versand in `.env.production` `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` und `MAIL_FROM` eintragen. Port 587 verwendet STARTTLS; für Port 465 `SMTP_SECURE=true` setzen. Ohne SMTP funktionieren Anmeldung, Termine, Listen und der direkte Passwortwechsel; E-Mail-Links sind dann noch nicht verfügbar.

```sh
docker run --rm --env-file .env.production -v "$PWD:/project" -w /project \
  node:24-bookworm-slim node scripts/check-production.mjs

docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

Danach `https://kalender.deine-domain.de` öffnen. Caddy wartet auf den Gesundheitscheck der App. Der Sicherungsdienst startet nach der App. Die Daten- und Zertifikat-Volumes bleiben bei Container-Neustarts und normalen Updates erhalten. `docker compose down -v` würde diese Volumes löschen und gehört nicht zum Update-Ablauf.

`TRUST_PROXY=true` ist für die mitgelieferte interne Proxy-Konfiguration vorgesehen. Caddy setzt die echte Client-IP für die Anmeldebegrenzung. Bei direktem Betrieb ohne diesen Proxy `TRUST_PROXY=false` verwenden.

## Bestehende Daten übernehmen

Auf dem bisherigen Rechner eine konsistente Sicherung erstellen, auch bei laufender lokaler App möglich:

```sh
node scripts/backup.mjs
```

Die ausgegebene Datei aus `backups/` auf den Server kopieren. Dort die Container zunächst erstellen und die Sicherung in das Sicherungs-Volume kopieren:

```sh
docker compose --env-file .env.production create --build app
docker compose --env-file .env.production cp ./import.sqlite app:/app/backups/import.sqlite
docker compose --env-file .env.production stop app backup
docker compose --env-file .env.production run --rm --no-deps app \
  node scripts/restore.mjs --file /app/backups/import.sqlite --confirm-stopped
docker compose --env-file .env.production up -d --build
```

Beim Import in eine vorhandene Installation vor dem Kopieren und Wiederherstellen zuerst `app` und `backup` stoppen. Der Restore legt einen neuen Datenbankstand an und bewahrt vorherige Datenbankdateien im Daten-Volume unter `before-restore-*` auf. Die Schema-Erweiterungen werden beim nächsten App-Start automatisch angewendet.

## Sicherungen und Wiederherstellung

Der Dienst `backup` erstellt beim Start und anschließend alle 24 Stunden einen konsistenten SQLite-Snapshot, prüft ihn und behält die neuesten 14 Sicherungen. Er liest die Quelldatenbank über einen schreibgeschützten Mount und schreibt nur in `miteinander_app_backups`. Die laufende App muss dafür nicht beendet werden. Grundlage ist die [SQLite-Backup-API von Node](https://nodejs.org/docs/latest-v24.x/api/sqlite.html#sqlitebackupsource-db-destination-options).

Eine zusätzliche manuelle Sicherung und die Dateiliste:

```sh
docker compose --env-file .env.production exec -T app node scripts/backup.mjs
docker compose --env-file .env.production exec -T app node -e \
  "require('node:fs').readdirSync('/app/backups').forEach(f=>console.log(f))"
```

Eine Sicherungsdatei auf einen anderen Rechner herunterladen, damit ein Ausfall oder Verlust des Servers nicht auch alle Sicherungen betrifft:

```sh
docker compose --env-file .env.production cp app:/app/backups/DATEI.sqlite ./DATEI.sqlite
```

Eine ausgewählte Sicherung wiederherstellen:

```sh
docker compose --env-file .env.production stop app backup
docker compose --env-file .env.production run --rm --no-deps app \
  node scripts/restore.mjs --file /app/backups/DATEI.sqlite --confirm-stopped
docker compose --env-file .env.production up -d
```

## Updates und Status

Vor einem Update eine Sicherung erstellen, die neuen Quelldateien übertragen und anschließend:

```sh
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail 80 app web backup
```

Der interne Gesundheitscheck ist `/api/health`. Die Anwendung läuft im Container ohne Root-Rechte und mit schreibgeschütztem Dateisystem; Daten und Sicherungen liegen ausschließlich auf den vorgesehenen Volumes. HTTPS-Zertifikate speichert Caddy separat.

## Stand der Prüfung

API, Einkaufsliste, gemeinsame Daten, Neustart-Persistenz, Sicherungsrotation, Datenintegrität, Wiederherstellung und Konfigurationsgenerator sind automatisiert geprüft. Die Ansichten werden mit Chrome auf Handy- und Tabletgrößen geprüft. Ein Docker-Start oder eine echte Hetzner-Bereitstellung konnte in der aktuellen Windows-Umgebung ohne Docker und ohne Serverzugang nicht durchgeführt werden. Deshalb auf dem Zielserver die oben aufgeführten Compose- und Gesundheitschecks ausführen.
