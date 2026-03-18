---
name: fix-at-appropriate-layer
description: |
  Avoid fixing display/presentation problems by modifying stored data. Use when:
  (1) considering normalizing dates/timestamps to fix timezone display issues,
  (2) tempted to transform data at ingestion to solve UI formatting problems,
  (3) debugging where data "looks wrong" in the UI but the underlying data is correct,
  (4) fixing localization/formatting issues by changing what gets stored.
  Core principle: Display issues belong in the display layer, not the data layer.
author: Claude Code
user-invocable: false
---

# Fix Problems at the Appropriate Layer

## Problem

When a value displays incorrectly in the UI, it's tempting to "fix" it by transforming
the data at the point of storage/ingestion. This destroys information and creates
subtle bugs in other parts of the system that depend on the original data.

## Context / Trigger Conditions

Watch for these warning signs:
- "The date shows as the wrong day" → About to normalize timestamps
- "The number looks weird" → About to round or format at storage time
- "Users see inconsistent values" → About to denormalize for display convenience
- "Timezone issues" → About to destroy timezone/time information
- Creating utility functions named `toXxxForStorage()` or `normalizeXxx()`

## The Anti-Pattern (What NOT to Do)

**Example: Timezone Display Issue**

Problem: Unix timestamp `1706745600` (2024-02-01T00:00:00Z) displays as "Jan 31" for PST users.

❌ **Wrong approach - Data layer fix:**
```typescript
// DON'T DO THIS: Normalizing to noon UTC destroys time information
function fromUnixSecondsAsCalendarDate(seconds: number): Date {
  const utcDate = new Date(seconds * 1000);
  return new Date(
    Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), 12, 0, 0, 0)
  ); // Forces noon UTC - DESTROYS original time
}
```

Problems with this approach:
1. **Data loss** - Original timestamp is gone forever
2. **Breaks other consumers** - Receipt matching, analytics, sorting may need actual times
3. **Future regret** - When you need the original data, it's gone
4. **Cascade effects** - Now you need to "fix" all other data sources the same way

## Solution: Fix at the Display Layer

✅ **Correct approach - Display layer fix:**
```typescript
// Keep original data
const transactionDate = new Date(timestamp * 1000);  // Original timestamp preserved

// Fix display using timezone option
function formatDateUTC(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',  // KEY: Interpret as UTC calendar date
    ...options,
  });
}

// Usage in UI
<span>{formatDateUTC(transaction.date, { month: 'short', day: 'numeric' })}</span>
```

## Layer Responsibility Guide

| Concern | Correct Layer | Wrong Layer |
|---------|---------------|-------------|
| Date formatting | UI/Display | Data storage |
| Currency symbols | UI/Display | Database |
| Timezone display | UI/Display | API/Storage |
| Number precision display | UI/Display | Calculations |
| Localization | UI/Display | Domain logic |
| Null/empty display | UI/Display | Data layer |

## Verification

Before implementing a "fix," ask:
1. **Who else uses this data?** List all consumers (matching algorithms, reports, exports, APIs)
2. **What information am I destroying?** If any, reconsider.
3. **Can I test the display fix in isolation?** Display fixes should be testable without touching data.
4. **Is this reversible?** Data layer changes often aren't.

## Example: Receipt Matching Impact

In a receipt-to-transaction matching system:
- Transactions normalized to noon UTC
- Receipts have actual email timestamps (various times)
- `daysBetween()` uses `Math.round(diff / msPerDay)`

**Result:** Same-day purchases can appear 1 day apart because:
- Transaction: Feb 1, 12:00 UTC (noon, normalized)
- Receipt: Feb 1, 00:00 UTC (midnight, from email)
- Difference: 12 hours = 0.5 days → rounds to 1 day

This broke matching confidence scores—a downstream effect of "fixing" at the wrong layer.

## Related Patterns

**Also avoid:**
- Denormalizing for display convenience (store computed values)
- Pre-formatting strings that should be numbers
- Storing display-ready HTML/markup
- Baking locale into stored data

**Exception:** Sometimes denormalization IS correct for performance. But "it displays wrong"
is never a valid reason—that's a display bug, not a data bug.

## Notes

- This principle applies beyond dates: amounts, names, statuses, etc.
- When in doubt, preserve fidelity at storage, transform at display
- If multiple display formats are needed, the data layer definitely shouldn't pick one
- Test data layer changes by asking: "What if I need to display this differently tomorrow?"
