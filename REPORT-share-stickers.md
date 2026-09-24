# Bericht: teilbare Sticker (Version 1.4)

Branch `feat/share-stickers` (Kolibi) und `legal/share-stickers` (Kolibi-web), beide gepusht. Nichts auf `main`, kein EAS-Build, kein OTA, keine Supabase-Änderung, `version` und `runtimeVersion` unverändert.

## Kurzfassung

| Block | Stand | Commits |
|---|---|---|
| 1 Pakete und Berechtigungen | fertig | `ec73311` `746d664` `236d8ba` `2f766ca` `8e757fc` |
| 2 Teilen-Maschine | fertig | `d6808f4` `bd197c2` `5044979` `cbd06e8` |
| 3 Sticker-Daten mit Tests | fertig | `7126beb` `5ca1a86` |
| 4 Sticker-Komponenten und i18n | fertig | `ff7bc85` `b71fa75` `e225ee2` `f5b68ce` `54f1316` `8da8e26` `b7216c0` `3bc2184` `862aa48` |
| 5 Einstiege | fertig | `1340b11` `6f242e8` `1278192` |
| 6 Prüfung | fertig, mit Einschränkung (Taps in der App kamen im Simulator nicht an, siehe unten) | keine Commits |
| 7 Datenschutzerklärung (Kolibi-web) | fertig | `a187b2d` |
| 8 Abschluss | dieser Bericht | Commit dieser Datei |

- **Tests:** `npm test` ergibt 494 von 494 grün (473 bestehende und 21 neue in `src/lib/share/sticker-data.test.ts`).
- **Typecheck:** `npx tsc --noEmit | grep -v "supabase/functions"` meldet 15 Fehler in 8 Dateien. Das ist identisch mit `main`, gemessen in einem sauberen Worktree von `main` mit denselben ignorierten Dateien (`.expo/`, `expo-env.d.ts`). Keine neuen Fehler.

## Alle Commits

### Kolibi, `feat/share-stickers`

Die Commits folgen der Reihenfolge der Abhängigkeiten, nicht der Block-Reihenfolge: erst die Daten, dann Export, Texte, Komponenten und Einstiege.

| Hash | Commit |
|---|---|
| `ec73311` | deps: share sticker libraries |
| `746d664` | config: localized permission texts (de) |
| `236d8ba` | config: localized permission texts (en) |
| `2f766ca` | config: localized permission texts (es) |
| `8e757fc` | config: add-only photo permission and English base permission texts |
| `7126beb` | share: pure sticker data builders grouped by exercise_id |
| `5ca1a86` | test: sticker data builders |
| `d6808f4` | share: capture a sticker PNG and save, copy or share it |
| `bd197c2` | analytics: share_sticker_created without content |
| `ff7bc85` | i18n: sticker texts (de) |
| `b71fa75` | i18n: sticker texts (en) |
| `e225ee2` | i18n: sticker texts (es) |
| `5044979` | share: StickerBrand with a slot for the Koli line drawing |
| `f5b68ce` | share: sticker frame, palettes and ladder dots |
| `54f1316` | share: exercise sticker |
| `8da8e26` | share: level sticker |
| `b7216c0` | share: session sticker |
| `3bc2184` | share: weekly and monthly recap sticker and story card |
| `862aa48` | share: pick the sticker component by kind |
| `cbd06e8` | share: ShareStickerSheet with preview, variants and actions |
| `1340b11` | training: share exercises, the session and a new level from the summary |
| `6f242e8` | history: share personal bests and new levels |
| `1278192` | history: share menu with image recap next to the text export |

### Kolibi-web, `legal/share-stickers`

| Hash | Commit |
|---|---|
| `a187b2d` | legal: privacy section for shareable stickers (1.4) |

## Block 1: Pakete und Berechtigungen

- **Pakete (installiert mit `npx expo install`):** `react-native-view-shot` 5.1.0, `expo-media-library` ~57.0.5, `expo-sharing` ~57.0.22, `expo-clipboard` ~57.0.2.
- **Plugin `expo-media-library`:**
  - Eingetragen sind nur `savePhotosPermission` (Englisch), `isAccessMediaLocationEnabled: false` und `granularPermissions: ["photo"]`.
  - Kein `photosPermission`: Den Lesetext `NSPhotoLibraryUsageDescription` liefert weiter `expo-image-picker`.
- **Plugin `expo-sharing`:** `expo install` hatte es eingetragen, ich habe es wieder entfernt. Es wird nur für eine Share-Extension gebraucht.
- **Texte in `app.json`:** Die bisher deutschen Health-Texte stehen jetzt auf Englisch. Die übersetzten Texte kommen über `expo.locales` aus `locales/de.json`, `locales/en.json` und `locales/es.json`.
- **Geprüft:** mit `expo config --type introspect` und den per Prebuild erzeugten `InfoPlist.strings`.

### Berechtigungstexte

| Schlüssel | DE | EN | ES |
|---|---|---|---|
| NSCameraUsageDescription | Erlaube Kolibi den Zugriff auf deine Kamera, um Fotos deiner Mahlzeiten aufzunehmen, Barcodes zu scannen und ein Profilbild festzulegen. | Allow Kolibi to access your camera to take photos of your meals, scan barcodes, and set a profile picture. | Permite que Kolibi acceda a tu cámara para hacer fotos de tus comidas, escanear códigos de barras y establecer una foto de perfil. |
| NSPhotoLibraryUsageDescription | Erlaube Kolibi den Zugriff auf deine Fotos, um ein Profilbild festzulegen. | Allow Kolibi to access your photos to set a profile picture. | Permite que Kolibi acceda a tus fotos para establecer una foto de perfil. |
| NSPhotoLibraryAddUsageDescription (neu) | Kolibi speichert deine Sticker in deinen Fotos. | Kolibi saves your stickers to your photo library. | Kolibi guarda tus stickers en tu fototeca. |
| NSHealthShareUsageDescription | Kolibi liest aus Apple Health Aktivenergie, Herzfrequenz, Schritte, Gehstrecke/Laufstrecke, Taillenumfang, Körperfettanteil, magere Körpermasse und Workouts, damit Tages- und Bewegungsziele deine Aktivität berücksichtigen können. | Kolibi reads active energy, heart rate, steps, walking/running distance, waist circumference, body fat percentage, lean body mass and workouts from Apple Health so that your daily and movement goals can take your activity into account. | Kolibi lee de Apple Health la energía activa, la frecuencia cardíaca, los pasos, la distancia caminando/corriendo, el perímetro de cintura, el porcentaje de grasa corporal, la masa corporal magra y los entrenamientos, para que tus objetivos diarios y de movimiento puedan tener en cuenta tu actividad. |
| NSHealthUpdateUsageDescription | Kolibi schreibt deinen erfassten Taillenumfang nach Apple Health, damit er dort zusammen mit deinen anderen Gesundheitsdaten sichtbar ist. | Kolibi writes your logged waist circumference to Apple Health so that it is visible there together with your other health data. | Kolibi guarda en Apple Health el perímetro de cintura que registras, para que se vea allí junto con tus demás datos de salud. |
| NSFaceIDUsageDescription | Erlaube Kolibi den Zugriff auf deine Face-ID-Daten. | Allow Kolibi to access your Face ID biometric data. | Permite que Kolibi acceda a tus datos biométricos de Face ID. |
| NSMicrophoneUsageDescription | Erlaube Kolibi den Zugriff auf dein Mikrofon. | Allow Kolibi to access your microphone. | Permite que Kolibi acceda a tu micrófono. |

- **Benachrichtigungen:** iOS kennt dafür keinen Berechtigungstext.
- **`NSLocalNetworkUsageDescription`:** Den Text gibt es nur in Dev-Builds (Dev Launcher), deshalb ist er nicht übersetzt.

## Block 2: Teilen-Maschine

Logik in `src/lib/share/`, Komponenten in `src/components/share/`.

- **`captureSticker(ref, { width: 1080 })`:** PNG als `tmpfile`.
  - `react-native-view-shot` versteht `width` und `height` auf iOS als Punkte und rechnet sie mit dem Bildschirmfaktor hoch. Deshalb teilt die Funktion die Pixelbreite durch `PixelRatio.get()` und setzt die Höhe anhand des gemessenen Views.
  - Ohne diese Korrektur wären die Bilder auf einem 3x-Gerät 3240 px breit geworden.
- **`saveStickerToPhotos(fileUri)`:** die neue API mit `MediaLibrary.Asset.create`, Berechtigung über `requestPermissionsAsync(true)`, also nur Hinzufügen.
- **`copySticker(fileUri)`:** liest die Datei über `File.base64()` aus `expo-file-system` und übergibt sie an `Clipboard.setImageAsync`.
- **`shareSticker(fileUri)`:** `Sharing.shareAsync` mit `image/png` und `public.png`.
- **`ShareStickerSheet`:**
  - Oben eine skalierte Vorschau.
  - Die Export-Kopie wird in voller Größe außerhalb des Bildschirms gerendert (`left: -1440`). Sie und ihr Inhalt haben keinen Hintergrund.
  - Umschalter Hell/Dunkel, beim Rückblick zusätzlich Sticker/Story-Karte.
  - Welche Schalter erscheinen, hängt von der Sticker-Art und den vorhandenen Daten ab.
  - Drei Aktionen mit kurzer Rückmeldung: „Gespeichert“, „Kopiert“, Fehler, fehlende Berechtigung mit Link zu den Einstellungen.
  - Der Inhalt ist scrollbar, damit er auch auf kleinen Geräten passt.
- **Stil:**
  - Hell: weiße Schrift mit Textschatten. Dunkel: Anthrazit `#1F2328`.
  - Badges in `BRAND_MINT`, Story-Hintergrund als Verlauf aus `BRAND_INDIGO` und `BRAND_INDIGO_DEEP`, Systemschrift wie in der App.
- **`StickerBrand`:** unten rechts „kolibi.app“, dazu ein markierter Platz (`mark`) für das SVG der Koli-Linienzeichnung.
- **PostHog:** Das Event `share_sticker_created` kennt nur `type`, `variant` und `action` und hat keine Inhalte.

## Block 3: Sticker-Daten

`buildExerciseSticker`, `buildLevelSticker`, `buildSessionSticker` und `buildRecapSticker(period)` sind reine Funktionen.

- **Gruppierung:** immer nach `exercise_id`. `bestSessionSets` sucht nur per ID. Im Rückblick gruppiert `personalBests` nach ID und lässt Sätze ohne ID aus.
- **Tests decken ab:**
  - gemischte Satzwerte
  - Zeit-Übungen
  - pro Seite
  - eigene Übung ohne Leiter
  - Woche ohne Einheiten
  - Protein 0 (die Zeile und der Schalter entfallen)
  - zwei Einheiten derselben Übung unter verschiedenen gespeicherten Namen ergeben einen Eintrag
  - vorherige Stufe aus der Leiter, wenn die Ausgangsübung unbekannt ist
  - nur angenommene Stufenaufstiege werden gezählt
- **Nie auf einem Sticker:** Körpergewicht, Körpermaße, Kalorienziele oder `weightKg`. Bei Übungen mit Zusatzgewicht stehen nur die Wiederholungen.

## Block 4: Sticker-Komponenten

- `src/components/share/stickers/`:
  - `ExerciseSticker`
  - `LevelSticker`
  - `SessionSticker`
  - `RecapSticker` (als Sticker und als Story-Karte 1080 × 1920)
  - `StickerView`, wählt die Komponente nach Art
  - `sticker-parts` mit Rahmen, Paletten, Leiter und Kennzahlen
- Die Texte stehen unter `share.*` in `src/i18n/locales/{de,en,es}.json`.

## Block 5: Einstiege

- **Zusammenfassung:**
  - Neuer Block „Übungen“ mit Name, Sätzen kompakt und Teilen-Symbol, führt zum Übungs-Sticker.
  - Button „Teilen“ für die ganze Einheit, führt zum Einheits-Sticker.
- **Feier-Karte:** Button „Teilen“ über „Weiter“, führt zum Stufen-Sticker.
- **Bestwerte-Liste:** Teilen-Symbol pro Bestwert (Übungs-Sticker) und an „Neue Stufe · …“ (Stufen-Sticker).
- **Fortschritt-Tab:**
  - Der vorhandene Teilen-Knopf öffnet eine Auswahl „Als Bild teilen“ oder „Als Text exportieren“ (auf iOS als Action Sheet, auf Android als Alert).
  - Der Zeitraum folgt dem 7/30-Filter, 30 Tage heißt „Mein Monat“.
  - Der Export bleibt Premium, die Sticker sind für alle frei.
  - Die Bedienungshilfen-Beschriftung des Knopfs heißt jetzt „Teilen“ statt „Export“.

## Block 6: Prüfung

- **Build:** `npx expo run:ios --device 451484D6-BFE6-4BAA-B85E-6CC5C0C335CA` (iPhone 17 Pro, iOS 26.5, Debug) mit 0 Fehlern.
  - Vorher `expo prebuild -p ios --no-install` und `pod install`, weil sich die Berechtigungstexte geändert hatten. `ios/` ist per `.gitignore` ausgeschlossen.
  - Metro lief auf Port 8082, weil auf 8081 das Projekt carpincho auf demselben Simulator lief. Das habe ich nicht angefasst.
- **Taps:** Im Systemdialog und im Dev-Menü kamen Taps an, in der Oberfläche der App nicht. Das passt zum bekannten Xcode-27-Problem aus `qa/ios-run-2026-09-19.md`.
  - Deshalb habe ich vorübergehend eine Dev-Seite mit Beispieldaten und einen Haken im Sheet eingebaut. Beides habe ich wieder entfernt, es ist nichts davon committed.
  - Die Berechtigung „Fotos hinzufügen“ habe ich per `simctl privacy grant photos-add` erteilt.

### Transparenz (Python/PIL)

| Datei | Größe | Modus | Ecken | voll transparent |
|---|---|---|---|---|
| exercise-light.png | 1080×993 | RGBA | 0 | 83 % |
| exercise-dark.png | 1080×993 | RGBA | 0 | 92 % |
| level-light.png | 1080×762 | RGBA | 0 | 80 % |
| level-dark.png | 1080×762 | RGBA | 0 | 91 % |
| session-light.png | 1080×1112 | RGBA | 0 | 78 % |
| session-dark.png | 1080×1112 | RGBA | 0 | 93 % |
| recap-light.png | 1080×1083 | RGBA | 0 | 77 % |
| recap-dark.png | 1080×1083 | RGBA | 0 | 93 % |
| photos-session-light.png (über das Sheet in Fotos gesichert) | 1080×1112 | RGBA | 0 | 78 % |
| photos-recap-story-light.png (Story-Karte, gewollt deckend) | 1080×1920 | RGBA | 255 | 0 % |
| clipboard-roundtrip-session-light.png | 1080×1112 | RGBA | 0 | 78 % |

- Bei der hellen Variante ist weniger Fläche durchsichtig, weil der Textschatten halbtransparente Pixel erzeugt.
- **Weg durch das echte Sheet:** Sichern ergab „saved“, Kopieren „copied“, Story-Karte sichern „saved“. Die PNGs liegen in `DCIM/100APPLE` des Simulators, also funktioniert die Export-Kopie außerhalb des Bildschirms.

### Zwischenablage

- Die Transparenz bleibt erhalten.
- iOS legt das kopierte Bild als `public.png` in die Zwischenablage, zusätzlich als `public.jpeg` und `com.apple.uikit.image`, geprüft per `simctl pbinfo`.
- Nach `copySticker` und `Clipboard.getImageAsync({ format: 'png' })` bleibt das Bild RGBA mit transparenten Ecken.
- „Kopieren“ bleibt deshalb drin. Ob die Ziel-App beim Einfügen PNG oder JPEG nimmt, entscheidet die Ziel-App. Das sollte man einmal auf einem Gerät mit Instagram prüfen.

### Sticker-PNGs

Die Dateien liegen in `~/Desktop/kolibi-sticker-check/` und sind nicht committed.

## Block 7: Datenschutzerklärung

- Ziffer 15a war auf `main` vorhanden.
- **Neu:** Ziffer 15b in DE und EN direkt nach 15a. In Ziffer 13 steht das neue Ereignis als letzter Listenpunkt, und der Satz zu den Inhalten ist ergänzt, jeweils in DE und EN.
- Das Stand-Datum ist unverändert.
- `npm run build` war erfolgreich. Nur der Branch ist gepusht.

## Abweichungen von der Vorgabe

1. **START:**
   - Der Branch `feat/share-stickers` existierte schon, mit der vorher freigegebenen, noch uncommitteten Arbeit. Die habe ich übernommen, statt neu anzufangen.
   - `git pull` auf `main` brachte nichts: `main` ist lokal 18 Commits vor `origin/main`.
   - `git status --porcelain` war nicht leer wegen `tmp/de-privacy/`, `tmp/de-terms/` und `tmp/en-terms/`. Die Ordner lagen schon vorher da, nicht von mir, und ich habe sie nicht angefasst.
   - **Wichtig:** Mit dem Push von `feat/share-stickers` stehen diese 18 noch nicht gepushten `main`-Commits jetzt als Teil des Branches auf GitHub. `main` selbst ist nicht gepusht.
2. **„Commit je Datei“:** `package.json` und `package-lock.json` sind ein gemeinsamer Commit, weil die Lock-Datei dazugehört. Sonst hat jede Datei ihren eigenen Commit. Die Reihenfolge folgt den Abhängigkeiten.
3. **Android-Berechtigungen:**
   - Auf iOS gibt es nur Hinzufügen.
   - Auf Android fügt `expo-media-library` immer `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` und `READ_MEDIA_VISUAL_USER_SELECTED` hinzu. Mit `granularPermissions: ["photo"]` kommt `READ_MEDIA_IMAGES` dazu. Das sind Lesezugriffe.
   - Audio- und Video-Berechtigungen sind gegenüber dem Standard des Plugins weggefallen.
   - Ohne Lesezugriff auf Android müsste man mit `android.blockedPermissions` arbeiten und die Speicherfunktion auf Android testen. Das habe ich nicht getan, siehe offene Fragen.
4. **Übersetzte Texte:** Face ID und Mikrofon sind mit übersetzt. Beide Texte kommen aus Plugin-Standards (`expo-secure-store`, `expo-image-picker`) und stehen im Build. Inhaltlich ist nichts erweitert.
5. **Protein-Zeile:** Statt `{{n}}` gibt es Plural-Schlüssel (`share.protein_one` und `share.protein_other` mit `{{count}}`), damit es „an 1 Tag erreicht“ und „cumplido 1 día“ heißt. Die Texte im Plural sind wie vorgegeben.
6. **Eltern ohne Hintergrund:** Die Export-Kopie liegt im Sheet. Dessen Glasfläche hat einen Hintergrund. Die Kopie selbst und alles darin sind ohne Hintergrund. `view-shot` zeichnet nur den erfassten View, und die PNG-Prüfung zeigt echte Transparenz.
7. **PostHog-Zahlwort:** Der Einleitungssatz in Ziffer 13 enthält kein Zahlwort, dort steht „die folgenden Ereignisse“. Es gab also nichts zu erhöhen. Ich habe nur den Listenpunkt und den Satz zu den Inhalten ergänzt.
8. **Kolibi-web:** Im Arbeitsverzeichnis lagen fremde, uncommittete Änderungen (`app/privacy/page.tsx`, `app/terms/page.tsx`, `tsconfig.tsbuildinfo`, zuletzt geändert 14:49).
   - Damit sie nicht in meinen Commit geraten, habe ich `legal/share-stickers` in einem separaten Worktree von `main` angelegt und bearbeitet. Der Worktree ist danach wieder entfernt.
   - Das Arbeitsverzeichnis von Kolibi-web ist unverändert auf `main` mit diesen fremden Änderungen. Deshalb ist `git status --porcelain` dort nicht leer.
9. **Block 6:** Die echten Einstiege habe ich nicht angeklickt, also Zusammenfassung, Feier-Karte, Bestwerte-Liste und Menü im Fortschritt-Tab. Der Simulator war nicht angemeldet, und Taps kamen in der App nicht an. Die Einstiege sind nur kompiliert und typgeprüft. Das Sheet mit Vorschau, Varianten und allen drei Aktionen ist im Simulator geprüft.
10. **Übungsname:** `buildExerciseSticker` nimmt `resolveExerciseName` auf die geladene Übung, also den aktuellen Namen. Ist die Übung nicht geladen, dient der gespeicherte Name als Ersatz. Beim größten Fortschritt im Rückblick wird der Name wie in der Bestwerte-Liste über `displayExerciseName` bestimmt.

## Offene Fragen

1. **Android:** Sollen die Lese-Berechtigungen von `expo-media-library` mit `android.blockedPermissions` entfernt werden? Dann muss „Als Bild sichern“ auf Android einmal getestet werden.
2. **Datenschutz, Ziffer 13:** Der Einleitungssatz spricht von „Ereignissen zum Ablauf der Registrierung und zur kostenlosen Nutzung“. Das neue Ereignis passt da nicht ganz hinein. Soll der Satz angepasst werden?
3. **Face ID und Mikrofon:** Beide Texte kommen aus Plugin-Standards, die App nutzt diese Funktionen wohl nicht. Abschalten, zum Beispiel mit `microphonePermission: false` bei `expo-image-picker` und `faceIDPermission` bei `expo-secure-store`?
4. **Neue Übungen:** In der Zusammenfassung zählt eine Übung, die jemand zum ersten Mal macht, als „Neuer Bestwert“, wie in der vorhandenen Bestwerte-Liste dort. In der Bestwerte-Liste des Fortschritt-Tabs zählt sie nicht. Soll das so bleiben?
5. **„Einheiten“ im Rückblick:** Gezählt werden nur Einheiten aus dem Trainingsplan, manuell erfasste Trainings nicht. Passt das?
6. **Story-Karte:** Der Inhalt wirkt auf 1080 × 1920 eher klein. Größer setzen?

## Was für 1.4 noch fehlt

- SVG der Koli-Linienzeichnung. Es wird als `mark` an `StickerBrand` übergeben, dort ist der Platz vorgesehen.
- Versionsänderung auf 1.4.0. Die `runtimeVersion` folgt über die Policy `appVersion`.
- Nativer EAS-Build, weil vier neue native Pakete und neue Berechtigungstexte dazukommen. Per OTA geht das nicht.
- Test auf einem Gerät mit angemeldetem Konto: alle vier Einstiege, die Nachfrage zur Foto-Berechtigung und das Einfügen in Instagram oder WhatsApp.
- Merge von `feat/share-stickers` nach `main` nach dem Release von 1.3.
- Merge von `legal/share-stickers` in Kolibi-web und das Stand-Datum setzen.
- Deploy-Marker für ErdiKnows erst, wenn 1.4 ausgeliefert ist.
