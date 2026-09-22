# Transfers between accounts — design

**Date:** 2026-09-22
**Status:** approved in conversation

## Purpose

Let the user move money from one of their own accounts to another, on its own
screen, saying which category (pot) the money belongs to. Today the only way
to do this is an "Add money" on the destination with no matching decrease on
the source, which inflates the total balance.

## Rules

A transfer is neither earning nor spending. It never enters the month's
arithmetic (`Income − Expenses − Savings − Investments`). It does two things:

1. **Moves a balance.** The source account goes down, the destination goes up,
   by the same amount.
2. **Moves a pot.** When a category is given, the source account's slice for
   that category goes down and the destination's slice goes up, so each account
   card's "what is in it" breakdown follows the money. An untagged transfer
   moves the "Not set" slice. A slice may go negative if a pot is moved out of
   an account that never had it recorded; that is shown honestly, not hidden.

Deleting an **account** takes its transfers with it, on both sides — a transfer
with a missing side records nothing (same rule as deposits). Deleting a
**category** leaves transfers in place with `categoryId` cleared on read, as
normalize already does for deposits.

## Data

```ts
export interface Transfer {
  id: string;                // 'tr_…'
  fromAccountId: string;
  toAccountId: string;       // must differ from fromAccountId
  amount: number;            // > 0
  categoryId: string | null; // optional; must exist if given
  date: string;              // YYYY-MM-DD
  note: string;              // ≤ 200 chars
  createdAt: string;
}
```

`FinanceData` gains `transfers: Transfer[]`. Nothing derived is stored.

## Layers (each mirrors `Deposit`)

| Layer | Change |
| --- | --- |
| `lib/types.ts` | `Transfer`, `FinanceData.transfers` |
| `lib/data/defaults.ts` | `transfers: []` |
| `lib/data/normalize.ts` | `normalizeTransfers` — drop if either account is missing or same, or amount ≤ 0; clear unknown category |
| `lib/validation.ts` | `validateTransfer(data, body)` — both accounts required and existing, different; amount; optional category; date; note |
| `lib/data/transfers.ts` | `createTransfer`, `updateTransfer`, `deleteTransfer` |
| `lib/data/accounts.ts` | `AccountUsage.transfers`; delete removes transfers touching the account under `unassign` |
| `app/api/transfers/route.ts`, `[id]/route.ts` | POST / PUT / DELETE |
| `lib/finance/calculations.ts` | `AccountBalance.transferredIn/Out` and balance formula; `getAccountContents` moves slices; `getAccountActivity` adds kind `'transfer'` with both legs; `getTransfersInMonth`, `getTransferOverview` for the page stats |
| `components/layout/navigation.ts` | `Transfers` between Accounts and Debts |
| `app/(app)/transfers/page.tsx` | server page: stats + `TransfersManager` |
| `components/transfers/TransfersManager.tsx` | list (newest first), new/edit modal, delete confirm |
| `components/accounts/AccountsManager.tsx` | delete dialog counts transfers; account activity renders the transfer kind |
| `README.md` | *Transfers* section under Accounts |

## Screen

Sidebar item **Transfers**. Page:

- Header: "Transfers — Money moved between your accounts".
- Stat strip: *Moved this month*, *Moved all time*, *Transfers* (count).
- **New transfer** button (top right). Modal form: Amount, Date, From account,
  To account, Category (optional; same grouped list as Add money), Note.
  Client shows the server's field errors, including "Choose a different
  account" on `toAccountId` when both are the same.
- Table, newest first: Date · From → To · Category · Note · Amount · edit /
  delete. Mobile: stacked list. Empty state explains what a transfer is.

Account activity rows read "Transfer to Cash" (out) / "Transfer from JS Bank"
(in), subtitle = note or category.

## Tests

- **calculations**: balances move on both sides; contents slice moves on both
  sides; untagged transfer moves "Not set"; month summary unchanged by a
  transfer; account activity shows both legs; `getTotalBalance` unchanged.
- **validation**: same account rejected; unknown account rejected; unknown
  category rejected; category optional; amount ≤ 0 rejected.
- **normalize / store**: transfer whose account is gone is dropped; unknown
  category cleared.
- **data (Mongo)**: create / update / delete round-trip; deleting an account
  with `unassign` removes its transfers.

## Out of scope

Transfers to or from external parties (that is income, an expense or a debt).
Recurring transfers. Fees on a transfer.
