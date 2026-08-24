# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## ErdiKnows deploy events

When you finish work that users will see in production or staging, post a deploy marker:

```bash
./scripts/erdi-event.sh "Short title — what landed, not the commit hash"
```

Post when:
- A feature or fix ships that someone using the product would notice
- You deploy or release to an environment users hit

Do not post for:
- Refactoring with no user-visible change
- Typo or copy edits alone
- Build or CI fixes
- Work that is not deployed yet

Set `ERDI_TOKEN` in `.env.local` (Settings → API). The script checks the environment and `./.env.local` (next to the repo root, resolved from the script path). Default API host: https://erdiknows.com. Optional: `ERDI_URL` to override.

`scripts/erdi-event.sh` is a copy. The current version lives in the ErdiKnows repo — run the setup block again (Settings → API) to replace an older copy.
