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

Set `ERDI_TOKEN_EVENTS` in `.env.local` (Settings → API). The script also accepts `ERDI_TOKEN`. It checks the environment and `./.env.local` (next to the repo root, resolved from the script path). Default API host: https://erdiknows.com. Optional: `ERDI_URL` to override.

`scripts/erdi-event.sh` is a copy. The current version lives in the ErdiKnows repo — run the setup block again (Settings → API) to replace an older copy.

## ErdiKnows metrics

The GitHub Actions workflow posts on a schedule. Manual runs are for catch-up only — for example filling a gap after a failed job, or backfilling older days with --from / --to:

```bash
./scripts/erdi-metrics.sh
```

Only post metrics your database can actually compute. Do not invent series, labels, or values to fill the chart. If a day has nothing to report, an empty array is fine.

Every metric needs a group — two or three groups for the whole set is right, not one per metric. Metrics that belong together share one. And set role where it applies: users, signups, revenue, paying_users (flow: new payers), spend, cost, tickets. Leave role empty for product-specific metrics; it maps a metric into the cross-project comparison. Do not send active_payers — Erdi derives that stock from subscribers. spend is what you pay to grow (ads, sponsorships, influencer). cost is what it costs to run (model calls, infrastructure, per-use APIs). Never put operating cost on spend — cost-per-customer is spend ÷ paying_users.

Before proposing anything, open Settings → Metrics in Erdi and read what is already there. Connected sources write their own metrics, and they are better at it than a query against your database:

   RevenueCat and Stripe    revenue, new_customers, new_paying_users, subscribers, trials, churn
   App Store Connect        downloads, proceeds, store funnel, ratings
   Play Console             installs, uninstalls
   Apple Ads                spend, impressions, taps, installs, CPA
   Plausible and Umami      visitors, pageviews

 Those numbers are the vendor's own — they account for refunds, grace periods and platform fees in ways a query won't. Don't send them from your database. If both arrive, Erdi adds them up for the same day and the chart is wrong until someone picks a source by hand.

 What you send is what nobody else can see: what happens inside the product between the install and the payment.

Then go looking. Read the schema and ask what this product would want to know if a number moved. Specifically check for:

 - Cost of operation. Model calls, API usage, anything metered per use. If a table logs tokens, requests or units consumed, that is a daily cost metric (role cost, not spend) — and almost nobody tracks it next to revenue.
 - The core action. The one thing a user does that means the product is working. Not opens, not sessions — the thing itself.
 - Failure rates. Wherever a table has a success or error column next to a count, both belong on the timeline. The gap between them explains drops that nothing else explains.
 - Funnel steps. Signup, activation, first action, payment. Send each as its own metric; the drop between two of them is the answer to most questions.
 - Anything with a status or type column and a small fixed set of values. One metric per value, sharing a group.
 - Post-install quality. What happens after someone arrives. Signups that finish onboarding on the same day, users still active a week later, first-purchase rate. Ad platforms report up to the install and stop; these are the numbers that say whether the install was worth buying. If the schema can express any of them as a daily count, they belong on the timeline.

 List what you found and what you decided to leave out, and say why. Leaving something out is fine — silently not looking is not.

Find the earliest real timestamp in the data — the first user, the first row — and send nothing for days before it. Same for a single metric whose feature arrived later. A zero means nobody did the thing that day. Days before the thing existed are not zeros, and drawing them as zeros turns a launch into a collapse.

If a campaign in Erdi has a key, send its daily numbers as mkt_<key>_installs and mkt_<key>_subs. Active keys are listed under Settings → Metrics, groups starting with 'Campaign:'. Only send keys that appear there.

`label`, `unit`, `group`, `role` and `direction` (`up_good` / `down_good`) are only read the first time a metric appears — rename later in Erdi project settings.

Set `ERDI_TOKEN_METRICS` (or `ERDI_TOKEN`) and `ERDI_TZ` in `.env.local` (Settings → API). The script reads the environment and `./.env.local` next to the repo root. Default API host: https://erdiknows.com. Optional: `ERDI_URL` to override.
