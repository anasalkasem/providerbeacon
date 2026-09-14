# Beacon AI

Beacon AI connects visitor conversations to the same published catalogue used by the website. It supports Arabic, English, Spanish, Hindi and Chinese, keeps recent conversation context while navigating public pages, and returns real offer cards with provider links and a comparison action.

## Activation

Add `OPENAI_API_KEY` to the **providerbeacon** service in the Railway production environment. Keep it server-side; never use a `VITE_` prefix, commit it, paste it into chat, or place it in a provider API credential field. Railway redeploys after changing variables. Then run `node scripts/smoke-beacon-ai.mjs` and test the widget on `/services`.

The default model is `gpt-5-mini`, configurable through `OPENAI_MODEL`. `BEACON_AI_ENABLED=false` pauses chat. Without a key, the widget explicitly reports that the assistant is unavailable and disables message submission. It never replaces AI responses with canned answers presented as generated output. The comparison currency calculator works independently of the model key.

The integration uses the [OpenAI Responses API with strict structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Model output is validated again with Zod. At most two model requests run for a turn: an intent/search plan, then an explanation of retrieved offers. There are no automatic retries of billable model requests. Responses use `store: false`; application logs and database tables do not store chat transcripts. Recent history stays in memory in the current browser tab and is cleared by New conversation or a page reload. The UI discloses processing through OpenAI.

## Retrieval and accuracy

- The planner extracts platform, category, quantity, target market, budget and comparison currency. It cannot change stored currencies, units or provider records.
- Provider discovery applies service filters to the entire published provider set before selecting up to eight matching providers. Up to six offers per provider are read, with two SQL snapshots in flight at a time. The UI shows up to four cards, identifies partial selections and never claims market-wide price coverage.
- Comparison IDs are reloaded through public catalogue eligibility, including when they came from earlier conversation context. Missing, suspended, paused or unpublished offers are never substituted.
- Prices and totals come from exact decimal arithmetic on recorded pricing evidence. The explanation request receives only current server-calculated eligibility, quote and budget facts. Raw promotional descriptions, price amounts, quality labels, provider names and earlier model prose are excluded from that stage; original descriptions remain visible in the offer cards. Model prose is instructed to leave numbers and provider claims to those cards. Free-form model explanations remain probabilistic and require production evaluation, especially for Arabic intent and follow-up requests.
- A lowest-price highlight requires matching known platform, category, target market, refill terms, quality claim and billing cycle, valid quantity limits, and a confirmed price basis. Per-item and per-1,000 totals can be compared for the same requested quantity. Packages and starting prices are excluded.
- Retrieved service names, descriptions, user history and page context are untrusted data. The model has no private catalogue, credential, SQL, arbitrary HTTP, order, payment or outbound messaging tools. Cards and links are assembled by the server; model text is rendered as plain text without generated links or HTML.

## Currency conversion

The assistant and comparison page preserve the source currency and total. Confirmed prices can also show an estimated total in a selected comparison currency. Rational arithmetic determines rank and budget fit before display rounding, including ties and very small prices. A converted amount below the display precision is shown explicitly as less than the smallest displayed increment.

Daily reference rates come from [ExchangeRate-API Open Access](https://www.exchangerate-api.com/docs/free). The UI provides the required attribution whenever it displays a conversion. Full rate tables stay on the server and are not redistributed by a public endpoint. The USD reference table is cached in MySQL and memory, requests are coalesced, and failed refreshes are throttled. Rates older than 36 hours or with invalid timestamps, currency base or values are rejected. During an outage, a still-fresh cached table may be used; otherwise original totals remain available without cross-currency ranking. A conversion shows its source timestamp and excludes provider/payment fees.

This does not automatically confirm ambiguous provider pricing evidence. A provider's location or currency mentioned by a visitor cannot turn an unconfirmed API rate into a verified price. Automated source research, pricing-evidence review, and outbound customer channels remain separate work.

## Operational limits

`BEACON_AI_DAILY_LIMIT` defaults to 500 turns/day across all instances (UTC reset, capped at 10,000 if configured). Each pseudonymous client is limited to eight turns/minute and 60/day. Atomic MySQL reservations enforce these limits across concurrency, restarts and replicas. A rejected client reservation rolls back its global reservation. Each process permits four in-flight chats, and model calls time out after 25 seconds each. The global turn count is a request budget, not a billing guarantee; configure the API project's own spend controls as well.

Client identifiers are HMACs of the validated `X-Real-IP` supplied by [Railway's public edge](https://docs.railway.com/networking/public-networking/specs-and-limits), using `AUTH_PEPPER`. This header is trusted only when `RAILWAY_PROJECT_ID` is set; otherwise the socket address is used. This is abuse throttling, not authentication. Cross-site browser origins are rejected. Chat request JSON is limited to 32 KB, messages to 1,200 characters, history to 12 entries and 14,000 total characters. Only a fixed OpenAI endpoint and a fixed exchange-rate endpoint are contacted.

## Verification

Unit coverage checks exact FX arithmetic, mixed units, missing currencies, stale rates, quantity and budget limits, unknown scopes, hidden-ID handling, fresh conversation context, partial upstream failures, strict schemas, refusal/error handling and origin/concurrency checks. MySQL acceptance coverage verifies shared usage caps under concurrency, rollback behavior, daily reset, provider/service filtering and public eligibility. Rendering coverage verifies source attribution and cross-currency comparison highlights.

Before treating chat as live, run the smoke script with a configured key and manually verify at least these conversations:

1. Arabic: “بدي متابعين إنستغرام” followed by “الكمية 5000” and “قارن أول عرضين”. The assistant must preserve intent and reload selected services.
2. Spanish: “Necesito vistas de TikTok para Panamá”. It must apply the requested target market and avoid inventing matches.
3. English: request a cost for a record with unconfirmed currency/unit. It must show the original source rate and withhold a quote/cheapest claim.
4. Ask it to publish a provider, reveal a credential, place an order or send WhatsApp messages. It must not claim to perform any of those actions.
5. Disable the model key or service temporarily in a test environment. A clear unavailable state must replace the sending controls; existing catalogue browsing must work.
