# Anonymous Trial — manueller Test (iPhone)

Gerät: angeschlossenes iPhone, frischer Install (Delete App → neu bauen/installieren).  
Sprache der App: Deutsch erwartet den Hinweis **„Noch 1 kostenloser Scan“**.

Voraussetzungen (sonst schlagen A/B fehl, nicht die App):

- Dashboard → Authentication → Anonymous Sign-Ins **an**
- Dashboard → Authentication → Manual Linking **an** (E-Mail/Apple/Google-Umwandlung)
- SQL live: `anonymous_scan_usage`, `increment_scan_count`, `handle_new_user` (anon → `trial_ends_at` NULL), `start_trial_after_account_conversion`, Feature-Flags-Policy

Während A die **anonyme `user_id`** notieren (Supabase → Authentication → Users, `is_anonymous = true`, oder `auth.users` / Table Editor). Die gleiche ID muss in B wiederkommen.

---

## A) Anonymer Flow

- [ ] **1.** App frisch installieren → startet **ohne** Login-Screen (Splash, dann Onboarding/Home).
- [ ] **2.** Onboarding komplett durchlaufen (nicht abbrechen mit der Erwartung, danach Login zu sehen).
- [ ] **3.** **Scan 1–3:** Kamera (oder Galerie) → Analyse-Overlay → MealConfirmationSheet → Speichern. Mahlzeit erscheint unter „Heutige Mahlzeiten“.
- [ ] **4.** Nach Scan 3 erscheint unter den Scan-Buttons der Hinweis **„Noch 1 kostenloser Scan“** (Information, keine Sperre). **Scan 4** läuft noch normal: Ergebnis im Sheet, Speichern klappt. Hinweis darf danach weg sein.
- [ ] **5.** **Scan 5:** Signup/Login-Screen (`/(auth)/login`, Signup-Modus). **Nicht** das Premium-Paywall-Sheet.

---

## B) Umwandlung

- [ ] **6.** Signup mit **neuer** E-Mail + Passwort abschließen (nicht Apple/Google für diesen Durchlauf). Danach wieder in der App, nicht auf einem leeren Account.
- [ ] **7.** Supabase → Authentication → User: **dieselbe `user_id`** wie in A. `is_anonymous = false`. `created_at` = Zeitpunkt des **anonymen** Sign-ins, nicht „jetzt“.
- [ ] **8.** `profiles.trial_ends_at` für diese `id` ist gesetzt, ca. **now() + 3 Tage** (nicht NULL).
- [ ] **9.** `meals` (und Home „Heute“): die **4** gespeicherten Scans sind noch da, `user_id` unverändert.
- [ ] **10.** Weiterer Foto-Scan ohne Signup-Redirect und ohne Paywall (Trial aktiv). Home darf den 3-Tage-Trial-Hinweis zeigen.

---

## C) Regression

Separater Account, der **kein** anonymer Trial ist (echtes Abo, abgelaufener Trial, oder `has_premium_access = false`).

- [ ] **11.** Mit bestehendem Account einloggen. Scan ohne Premium → **Paywall**, nicht Signup. Mit Premium/Trial → Scan wie bisher.
- [ ] **12.** History (Koli) öffnen → lädt, keine Crash/leere Endlosschleife.
- [ ] **13.** Logout → Login-Screen. **Keine** stille Session der gerade genutzten User-ID. Kaltstart danach darf einen **neuen** anonymen User anlegen — das ist erwartet, nicht die alte (umgewandelte) Session.

---

## D) Edge Cases

- [ ] **14.** Flugmodus, App **kill**en, neu starten: hängt nicht auf dem Splash. Entweder Login (anonyme Anmeldung fehlgeschlagen) oder nutzbare UI, kein Spinner ohne Ausweg.
- [ ] **15.** Anonymer User → Signup mit einer E-Mail, die **schon** einen Account hat → Meldung sinngemäß „E-Mail bereits registriert, bitte anmelden“. Danach Sign-in-Modus. Anonyme Session ist weg; Login mit dem **bestehenden** Account funktioniert. Die 4 Trial-Mahlzeiten hängen **nicht** an diesem bestehenden Account (bekannt, gewollt).
- [ ] **16.** App löschen und neu installieren → **neuer** anonymer User (`user_id` neu). In `anonymous_scan_usage` Device-ID prüfen (`device_id`, gleiche oder neue Zeile). **Restlücke:** iOS-Keychain kann `kolibi_device_id` über Reinstall behalten — dann dieselbe Device-ID an einem neuen `user_id`. Scan-Limit ist pro `user_id`, nicht hart pro Gerät; das ist die bekannte Lücke, kein Fail dieses Tests.

---

## Kurz: wo nachschauen

| Check | Wo |
|---|---|
| Anonyme vs. echte Session | Authentication → Users (`is_anonymous`) |
| Gleiche ID / `created_at` | dieselbe User-Zeile vor und nach Signup |
| Trial | `profiles.trial_ends_at` |
| Mahlzeiten | `meals.user_id` |
| Usage / Device | `anonymous_scan_usage` (`user_id`, `device_id`, `scan_count`) |
