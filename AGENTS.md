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

## ErdiKnows metrics

Once a day, post yesterday's product numbers:

```bash
./scripts/erdi-metrics.sh
```

Only post metrics your database can actually compute. Do not invent series, labels, or values to fill the chart. If a day has nothing to report, an empty array is fine.

Every metric needs a group — two or three groups for the whole set is right, not one per metric. Metrics that belong together share one. And set role where it applies: users, signups, revenue, paying_users, spend, tickets. Leave role empty for product-specific metrics; it maps a metric into the cross-project comparison and only makes sense for the six named roles.

Find the earliest real timestamp in the data — the first user, the first row — and send nothing for days before it. Same for a single metric whose feature arrived later. A zero means nobody did the thing that day. Days before the thing existed are not zeros, and drawing them as zeros turns a launch into a collapse.

Before adding a metric, check Settings → Metrics. If a connected source already reports it, either skip it or give yours a different name — Erdi adds up values from different sources for the same day.

If a campaign in Erdi has a key, send its daily numbers as mkt_<key>_installs and mkt_<key>_subs. Active keys are listed under Settings → Metrics, groups starting with 'Campaign:'. Only send keys that appear there.

`label`, `unit`, `group`, `role` and `direction` (`up_good` / `down_good`) are only read the first time a metric appears — rename later in Erdi project settings.

Set `ERDI_TOKEN` and `ERDI_TZ` in `.env.local` (Settings → API). The script reads the environment and `./.env.local` next to the repo root. Default API host: https://erdiknows.com. Optional: `ERDI_URL` to override.
