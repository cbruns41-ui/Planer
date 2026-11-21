# Miteinander

Gemeinsamer Kalender, Essensplan und Einkaufsliste als installierbare Web-App für Android, iPhone, iPad und Desktop. Node.js 24, SQLite und Nodemailer für SMTP-E-Mails.

Quellcode: [cbruns41-ui/Planer](https://github.com/cbruns41-ui/Planer). [GitHub Actions](https://github.com/cbruns41-ui/Planer/actions) prüft Commits und Pull Requests automatisch, einschließlich Tests, Docker-Build, Containerstart und Datenbanksicherung. Hetzner ist vorerst zurückgestellt; es gibt keinen aktiven Veröffentlichungsworkflow. Die vorbereiteten Dateien bleiben für später erhalten.

## Starten und anmelden

Für den Hetzner-Betrieb gibt es eine vollständige [Anleitung mit Docker, HTTPS, zentralen Daten, Sicherung und Wiederherstellung](deploy/README.md). Die Konfiguration wird über `scripts/configure-production.mjs` erstellt. Ohne Serverzugang wird nichts automatisch veröffentlicht.

```sh
npm install
npm start
```

Unter Windows alternativ `Start-Miteinander.cmd` doppelklicken. Falls PowerShell `npm.ps1` blockiert, `npm.cmd` verwenden.

Anschliessend **http://localhost:3100** oeffnen. Zuerst erscheint die Anmeldeseite.

- **Nutzername:** `Bruns`
- **Passwort bei der ersten Anmeldung:** `Test1234`

Der Zugang wird beim ersten Start dieser Version einmalig angelegt. Ein geaendertes Passwort wird bei spaeteren Neustarts **nicht ueberschrieben**. Bestehende Konten und Kalender bleiben erhalten; das Schema wird ergaenzt. Mit `SEED_BRUNS=false` laesst sich das Anlegen des Startkontos fuer weitere Installationen abschalten.

Nach der Anmeldung fuehrt die Startseite mit grossen Kacheln zu Kalender, Essensplan, Wetter und Einstellungen. Auf Handy und Tablet gibt es eine untere Navigation. Eine bestehende Sitzung bleibt beim erneuten Oeffnen erhalten; nach dem Abmelden erscheint wieder die Anmeldung.

## Personen und Geburtstage

Das Seitenmenü lässt sich auf allen Geräten mit dem kleinen Pfeil am linken Rand aus- und einklappen. Im Kalender startet es geschlossen. Die Kalenderansicht nutzt die verfügbare Bildschirmhöhe; Begrüßung, Fußzeile, untere Navigation und eine dauerhafte Tages-Seitenleiste entfallen dort. Tagesdetails erscheinen nach einem Tipp auf den Tag. Filter und Suche öffnen sich über den Filterknopf. Auf unterstützten Browsern kann zusätzlich die Vollbildfunktion verwendet werden.

Ein Account kann mehrere Personen verwalten. Unter **Personen > Person hinzufügen** einen Vornamen und eine Farbe hinterlegen. Dafür sind keine weiteren Zugangsdaten nötig. Name und Farbe lassen sich nachträglich ändern; die vorhandenen Termine bleiben zugeordnet.

Bei einem Termin unter **Für wen?** die Person auswählen. Ihr Vorname und ihre Farbe erscheinen auf der Startseite, in Terminlisten, im Tagesplan und auf den Einträgen des Monatskalenders. Gemeinsame Termine tragen die Markierung **Alle zusammen**. Auf kleinen Handys startet der Kalender mit der lesbaren Listenansicht; zur Monatsansicht kann jederzeit gewechselt werden.

Unter **Personen** eine Person antippen. Die Ansichten **Anstehend**, **Alle Termine** und **Vergangen** listen ihre Termine unabhängig vom gerade geöffneten Kalendermonat auf. Ein neuer Termin aus dieser Ansicht übernimmt die ausgewählte Person automatisch.

Die Seite **Geburtstage** enthält eine eigene Liste für alle eingetragenen Geburtstage, nach dem nächsten Datum sortiert. Geburtstage lassen sich einem Profil zuordnen oder für Freunde und Verwandte frei eintragen. Das Geburtsjahr ist optional; wenn es bekannt ist, wird das kommende Alter angezeigt. Einmal eingetragene Geburtstage erscheinen jährlich im Kalender. Der 29. Februar wird nur in Schaltjahren angezeigt. Bereits mit der Kategorie Geburtstag gespeicherte Termine erscheinen ebenfalls in der Liste; ihr Terminjahr wird nicht als Geburtsjahr interpretiert.

## E-Mail und Passwort

Unter **Einstellungen > Dein Konto** die eigene E-Mail-Adresse und zur Bestaetigung das aktuelle Passwort eingeben. Die Adresse wird dauerhaft gespeichert. SMTP-Zugangsdaten gehoeren in die Serverkonfiguration, nicht in das E-Mail-Feld des Kontos.

Das Passwort laesst sich ueber **Passwort aendern** mit dem aktuellen Passwort sofort aendern. Dabei werden bestehende Sitzungen abgemeldet und eine neue Anmeldung wird noetig.

Fuer das Aendern oder Zuruecksetzen **per E-Mail**:

1. `.env.example` nach `.env` kopieren und SMTP sowie `PUBLIC_ORIGIN` eintragen. `npm start` liest `.env` automatisch ein; nach Aenderungen den Server neu starten.
2. Die Adresse in den Einstellungen speichern oder den Bestaetigungslink erneut senden.
3. Den Link in der E-Mail oeffnen und die Adresse bestaetigen. Er gilt 24 Stunden und funktioniert einmal.
4. Auf der Anmeldeseite die Passwort-vergessen-Funktion waehlen oder in den Einstellungen einen Passwort-Link anfordern. Der Link gilt 30 Minuten und funktioniert einmal. Nach dem Zuruecksetzen werden alle Sitzungen des Kontos beendet.

Ohne eingerichteten SMTP-Versand zeigt die App dessen fehlende Einrichtung an. Die Adresse laesst sich trotzdem speichern und der direkte Passwortwechsel funktioniert. Es werden keine Passwort-Links in der Oberflaeche oder in Logs ausgegeben. In der Datenbank liegen nur Hashes der Tokens. Der Versand verwendet [Nodemailer SMTP](https://nodemailer.com/smtp); zeitlich begrenzte, einmal verwendbare Ruecksetzlinks orientieren sich am [OWASP-Leitfaden](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Gemeinsam auf mehreren Geraeten

Die gemeinsame **Einkaufsliste** ist über Startseite, Seitenmenü und die mobile Navigation erreichbar. Alle Personen können Einträge, Mengen und eine Person hinterlegen, Einkäufe abhaken oder wieder öffnen und bestehende Einträge bearbeiten. Die Liste und auch der Wetterort liegen auf dem Server und bleiben nach einem Neustart erhalten. Auf der Einkaufsseite werden Änderungen anderer Geräte automatisch regelmäßig übernommen. Ohne Verbindung werden keine nur lokal gespeicherten Einträge vorgespiegelt.

Weitere Nutzer koennen auf der Anmeldeseite ein eigenes Konto erstellen. Unter **Einstellungen > Zusammen nutzen** den Einladungscode kopieren und beim Erstellen des weiteren Kontos eingeben. Mitglieder desselben Zuhauses teilen Kalender und Essensplan und koennen deren Eintraege bearbeiten. Ohne Code wird ein eigenes Zuhause angelegt. Bestehende Konten koennen weiterhin ihre E-Mail-Adresse zum Anmelden verwenden.

Die Synchronisierung erfolgt bei geoeffneter App alle 15 Sekunden sowie beim Zurueckkehren in die App. Termine und Mahlzeiten werden auf dem Server gespeichert. Fuer gemeinsame Inhalte ist eine Serververbindung noetig. Die Anmeldeoberflaeche ist nach dem ersten Laden auch offline erreichbar; private API-Antworten werden nicht im Service Worker gespeichert. Die fruehere lokale Demo ist nicht mehr die Einstiegsseite; vorhandene Demo-Daten im Browser werden nicht in das Bruns-Konto uebertragen.

Der Essensplan enthaelt pro Woche Mittag- und Abendessen. Eine Mahlzeit antippen, Gericht und optionale Notizen speichern. Ein leeres Gericht entfernt den Eintrag.

## Android und iOS

- **Android / Chrome:** Menue > App installieren bzw. Zum Startbildschirm hinzufuegen.
- **iPhone / iPad / Safari:** Teilen > Zum Home-Bildschirm.

Die Oberflaeche beruecksichtigt sichere Bildschirmraender und bietet groessere Eingabefelder und Touch-Flaechen. Fuer Installation und Service Worker ausserhalb von localhost ist HTTPS noetig. Es handelt sich um eine PWA; eine APK oder App-Store-Veroeffentlichung ist nicht enthalten.

Im selben WLAN kann ein weiteres Geraet die IP des Rechners mit Port 3100 oeffnen, beispielsweise `http://192.168.1.20:3100`. Der Rechner muss laufen und die Firewall den Port zulassen. Fuer die WLAN-Vorschau `PUBLIC_ORIGIN` nicht auf `localhost` festlegen: entweder die konkrete WLAN-Adresse eintragen oder die Variable leer lassen. E-Mail-Links benoetigen eine ausdruecklich konfigurierte Origin. Im spaeteren Betrieb verwenden alle Geraete dieselbe HTTPS-Adresse des Hetzner-Servers.

Feiertage kommen von feiertage-api.de; Wetter und Ortssuche von Open-Meteo. Regionale Einschraenkungen von Feiertagen stehen in deren Details.

## Serverkonfiguration

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `3100` | HTTP-Port |
| `HOST` | `0.0.0.0` | Netzwerkschnittstelle |
| `DATA_DIR` | `./data` | SQLite-Datenbank und persistente Daten |
| `PUBLIC_ORIGIN` | nicht gesetzt | Fuer E-Mail-Links ausdruecklich setzen; auf Hetzner z. B. `https://kalender.example.de`, ohne Pfad. Bei gesetztem Wert muessen Browserzugriffe genau diese Origin verwenden. |
| `COOKIE_SECURE` | nicht gesetzt | Bei HTTPS `true` setzen |
| `SEED_BRUNS` | `true` | Startkonto einmalig anlegen |
| `SMTP_HOST` | nicht gesetzt | SMTP-Server des Mailanbieters |
| `SMTP_PORT` | `587` | SMTP-Port, alternativ haeufig `465` |
| `SMTP_SECURE` | `false` | Fuer direktes TLS `true`, z. B. Port 465; auf Port 587 wird STARTTLS verlangt |
| `SMTP_USER` | nicht gesetzt | SMTP-Nutzername |
| `SMTP_PASSWORD` | nicht gesetzt | SMTP-Passwort |
| `MAIL_FROM` | nicht gesetzt | Absenderadresse, die der Mailanbieter erlaubt |
| `SMTP_LOCAL_RELAY` | `false` | Unverschluesselter lokaler SMTP-Relay; nur fuer localhost/127.0.0.1/::1 zulaessig |

Auf Hetzner: Node hinter einem HTTPS-Reverse-Proxy betreiben, `PUBLIC_ORIGIN` auf die oeffentliche HTTPS-Adresse und `COOKIE_SECURE=true` setzen. Der Versand externer E-Mail-Links verlangt HTTPS. Das Grundgeruest wurde noch nicht auf Hetzner bereitgestellt.

Konten, Personen, Termine und Mahlzeiten liegen in `data/calendar.sqlite`. Zur Sicherung den Server beenden und den gesamten Ordner `data` kopieren. Passwoerter werden mit scrypt gehasht; Sitzungen verwenden HttpOnly-Cookies.

## Pruefen

```sh
npm test
node scripts/verify-browser.mjs
```

Die Tests verwenden eigene temporaere Datenbanken. Der E-Mail-Test verwendet einen lokalen Test-SMTP-Server und verschickt keine externen Nachrichten. Er prueft Bestaetigung, Token-Ablauf, Einmalnutzung und Sitzungswiderruf. Der Browsercheck benoetigt Chrome, testet die Ansichten von 320 bis 1440 Pixel Breite und erzeugt Screenshots in `tmp`. Alternativen lassen sich ueber `CHROME_PATH` angeben. Ein Test auf echten Android-/iOS-Geraeten ist damit nicht ersetzt.

App-Symbole erneut erzeugen (Windows):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
```
