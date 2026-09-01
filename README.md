# My Finance

A private personal finance app. No user accounts, no subscriptions — one password and
one MongoDB document holding everything. Runs free on Vercel with a free Atlas cluster,
or locally against any MongoDB.

## Running it

```bash
npm install                      # first time only
cp .env.example .env.local       # then fill in MONGODB_URI
npm run dev
```

Then open <http://localhost:3000>. No password is needed when running locally — but a
database connection is, so `MONGODB_URI` has to be set even for development.

Point it at the same free Atlas cluster you deploy with, and set `MONGODB_DB` to
something like `my-finance-dev` so experiments never touch your real records.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app for everyday use |
| `npm run build` then `npm start` | Production build; `npm start` binds `$PORT` (3000 by default) |
| `npm test` | Run the calculation and persistence tests |
| `npm run typecheck` | Type-check without building |

## Where your data lives

Everything sits in a **single MongoDB document**:

```
database: my-finance
├── finance    { _id: 'primary', rev, updatedAt, data: { ...everything } }
└── backups    the 10 most recent snapshots, newest first
```

One document rather than a collection per entity is a deliberate choice. This data is
one person's complete financial picture and is always read as a whole — the dashboard
needs income *and* expenses *and* budgets together to produce a single figure. Keeping
it in one document makes every save atomic in a single round trip. Ten years of daily
spending comes to well under a megabyte, against MongoDB's 16 MB document limit.

**Concurrency.** Saves use optimistic concurrency on the `rev` counter: a write only
lands if the document has not changed since it was read. If it has, the change is
re-applied against fresh data rather than overwriting. Retries back off with jitter
until an 8-second deadline, so no save is lost even when several land at once — which
matters on Vercel, where requests are spread across instances that cannot coordinate.

**Backups.** The previous state is copied into the `backups` collection before every
change, and the ten most recent are kept. Restore any of them from Settings. Atlas M0
has no automated backups of its own, so also export a copy to your machine now and
then — Settings → Export data.

**Repair.** Anything structurally odd coming back from the database is repaired on read
by `normalizeData` rather than throwing: unknown fields dropped, missing arrays
rebuilt, rows referencing a deleted category discarded. A hand-edited document cannot
lock you out of the app.

## How the app thinks about money

Three kinds of outgoing money are tracked separately, because lumping them together
makes the numbers lie:

- **Expenses** — money consumed. Food, fuel, bills.
- **Savings** — money set aside for later.
- **Investments** — money moved into an investment.

Savings and investments never count as spending. A month works out as:

```
Income − Expenses − Savings − Investments = Remaining (unallocated)
```

A category's `type` decides which bucket it falls into, and you can change or add
categories in Settings.

### Budgets

A budget is just a month plus an amount per category. Nothing else is stored — *spent*,
*remaining* and *% used* are worked out from your actual transactions every time they
are shown, so the budget and the transaction list can never disagree.

Click any category on the Budget or Dashboard page to see exactly what that budget was
spent on: every transaction with its date, description and account, plus the count and
average.

### Debts

Recording a debt notes who and how much; it moves no money. Payments move money.

When you record a payment on a debt you owe, you choose **which allocation it comes out
of**. That writes an ordinary transaction against that budget category, so the payment
counts against the budget, appears in the category drill-down, reduces the account you
paid from, and shows up in analytics — with no separate debt ledger to fall out of sync.

Deleting a debt keeps its payments. That money really did leave your account, so
removing it would inflate your balances.

### Accounts

Balances are never typed in. Each is:

```
opening balance + income received in + repayments received − everything paid out
```

Leaving the account blank on an expense is fine — it still counts towards your spending
and budgets, it just does not move a balance.

## Project layout

```
middleware.ts           The password gate — runs before every page and handler
app/
├── (app)/              Everything behind the password: Dashboard, Income,
│                       Expenses, Budget, Analytics, Goals, Accounts,
│                       Debts, Settings — plus the sidebar shell
├── login/              The sign-in screen, outside the shell
└── api/                Route handlers — the only things that write to disk

components/             Reusable UI, grouped by feature
lib/
├── data/               The data-access layer
│   ├── store.ts        The ONLY module that reads or writes stored data
│   ├── mongo.ts        Cached connection, collections, indexes
│   ├── normalize.ts    Repairs anything malformed on the way in
│   └── *.ts            CRUD per entity
├── finance/
│   ├── calculations.ts Every displayed number is computed here
│   ├── dates.ts        Month/date handling (string maths, no timezones)
│   └── format.ts       Currency formatting
├── auth/session.ts     Password check and signed session cookies
├── validation.ts       Server-side validation for every mutation
└── types.ts            The shape of finance.json

tests/                  Calculation, persistence and auth tests
```

Two rules hold the design together:

1. **`lib/finance/calculations.ts` is the only place a financial figure is computed.**
   The dashboard, budget page, category drill-down and analytics all call the same
   functions, so there is exactly one implementation to be right or wrong.
2. **Nothing calculated is ever stored.** If a value can be derived from transactions,
   it is derived — every time.

The browser never sends a total and never touches the JSON file. It posts raw fields to
a route handler, which re-validates them against the file as it exists at that moment.

## Deploying it

Vercel plus a free MongoDB Atlas cluster. Both free tiers are enough; there is nothing
to pay for.

### 1. Create the database

1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas) and create an **M0**
   cluster — free forever, 512 MB, no card.
2. Choose a region close to your Vercel region. Every page load makes a round trip, so a
   mismatch is felt on every click. `vercel.json` pins Vercel to **Mumbai (`bom1`)**;
   pair it with Atlas **ap-south-1 (Mumbai)**. Change both together if you are elsewhere.
3. **Database Access** → add a user with a strong password. Note it down.
4. **Network Access** → allow `0.0.0.0/0`. Vercel's functions have no fixed IP
   addresses, so an allowlist cannot work. Your database user's password is what
   protects the cluster.
5. **Connect → Drivers → Node.js** → copy the connection string. Replace `<db_password>`
   with the database user's password. URL-encode it if it contains `@ : / #`, or pick a
   password with only letters and digits.

### 2. Push and import

`.gitignore` already excludes `.env.local`, so no secret travels with the code.

```bash
git init && git add . && git commit -m "My finance app"
git remote add origin <your-github-repo>
git push -u origin main
```

Then on Vercel: **Add New → Project → import the repo**. Framework is detected as
Next.js; leave the build settings alone.

### 3. Set two environment variables

Before the first deploy, add these under **Environment Variables** (all environments):

| Variable | Value | Why |
| --- | --- | --- |
| `MONGODB_URI` | the Atlas connection string | Where the data lives. |
| `FINANCE_PASSWORD` | a long passphrase | The app has no user accounts. Without it, anyone with the URL can read and edit your finances. |

`MONGODB_DB` is optional and defaults to `my-finance`.

**A production build with no `FINANCE_PASSWORD` refuses to serve anything at all** — it
returns 503 with instructions instead. That is deliberate: the alternative failure mode
is publishing your finances, so it fails closed.

### 4. Deploy and sign in

Open the URL, enter your password, and the database seeds itself with default categories
and accounts. If you have data from elsewhere, bring it across with **Settings → Import
data**.

### Notes on running it this way

- Signing in lasts 30 days per device. Changing `FINANCE_PASSWORD` signs every device out
  immediately.
- Your records live on Atlas rather than on your own machine. Export occasionally if you
  want an offline copy you control — Atlas M0 has no automated backups of its own.
- Changing an environment variable does not affect the running deployment. **Redeploy**
  after editing one.
- The app works on any MongoDB, not just Atlas — a local `mongod` or a container is fine
  for development.

### Two settings that exist only for the deploy

- **`package.json` → `config.mongodbMemoryServer.disablePostinstall`.** Vercel installs
  devDependencies to build, and `mongodb-memory-server` would otherwise download a
  ~100 MB mongod binary on every deploy for a test suite that never runs there.
- **`package.json` → `engines.node: ">=20"`.** The store uses `structuredClone`.

## Notes

- The app is single-user by design: one password, no accounts, no permissions.
- Login attempts are rate-limited to 10 per 15 minutes per address.
- The browser never sends a total and never talks to the database. It posts raw fields
  to a route handler, which re-validates them against the stored document.
- `npm audit` reports a build-time PostCSS advisory that comes in through Next's own
  toolchain. It affects CSS processing during a build, not the running app, and there is
  no exposure for a local single-user tool.
