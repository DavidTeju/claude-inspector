---
name: test-debugging-without-hacking
description: |
  Systematic approach to fix failing tests by finding root causes, not by modifying tests
  to pass. Use when: (1) multiple tests fail after code changes, (2) you're tempted to
  change test assertions to match "new behavior", (3) tests pass individually but fail
  together, (4) need to distinguish between test bugs and service bugs. Covers: prompting
  patterns that establish quality constraints, systematic debugging methodology, decision
  framework for what to fix, and verification before changes.
author: Claude Code
user-invocable: false
---

# Test Debugging Without Hacking

## Problem

When tests fail, there's a temptation to "hack" them by:
- Changing assertions to match current (possibly broken) behavior
- Removing failing tests
- Mocking more aggressively to avoid the real issue
- Changing test data to sidestep the failure

This skill provides a systematic approach to fix the *actual* problem.

## Context / Trigger Conditions

Use this when:
- Multiple tests fail after making code changes
- Tests passed before but fail now with no obvious reason
- You're considering changing test expectations to "fix" failures
- Tests pass in isolation but fail when run together
- Error messages don't clearly point to the root cause

## Effective Prompting Patterns

### 1. Establish Quality Constraints Upfront

```
"Promise me you won't hack the tests"
"Fix the actual bugs, don't change tests to pass"
"I want root cause fixes, not workarounds"
```

**Why it works**: Sets a clear quality bar that prevents shortcuts.

### 2. Grant Permission to Investigate

```
"If you're confused about something, ask me questions"
"Debug properly - don't guess"
"Take time to understand before fixing"
```

**Why it works**: Removes time pressure that leads to shallow fixes.

### 3. Require Verification Before Action

```
"Explain what you think the problem is before fixing it"
"Show me your hypothesis first"
"What's your evidence that this is the root cause?"
```

**Why it works**: Forces articulation of understanding, catches wrong assumptions.

## Systematic Debugging Methodology

### Step 1: Read Both Sides

**Don't just read the test OR the service - read BOTH.**

```
1. Read the failing test completely
   - What does it set up?
   - What does it assert?
   - What mocks does it create?

2. Read the service code being tested
   - What does it actually do?
   - What dependencies does it call?
   - What does it return?

3. Identify the mismatch
   - Does the mock provide everything the service needs?
   - Does the test assert what the service actually returns?
```

### Step 2: Trace Execution Path

Mentally execute the code path:

```
Test Setup
    ↓
Mock Configuration
    ↓
Service Function Called
    ↓
Service Uses Mock (does mock have what service needs?)
    ↓
Service Returns Value
    ↓
Test Assertion (does test expect what service returns?)
```

Ask at each step: "What actually happens here?"

### Step 3: Run Isolated Tests

Before fixing, verify your hypothesis:

```bash
# Run just the failing test
npm run test -- -t "test name"

# Run just the test file
npm run test -- path/to/test.ts

# Run with verbose output
npm run test -- --reporter=verbose path/to/test.ts
```

If test passes in isolation but fails in suite → mock state pollution (see vitest-mock-implementation-persistence skill)

### Step 4: Classify the Bug

**Is this a TEST bug or a SERVICE bug?**

| Test Bug (fix the test) | Service Bug (fix the service) |
|------------------------|------------------------------|
| Test doesn't mock all required dependencies | Service returns wrong value |
| Test asserts wrong expected value | Service throws unexpected error |
| Test has incorrect setup | Service has logic error |
| Mock implementation is incomplete | Service missing null checks |
| Test expectation based on misunderstanding | Service behavior changed unintentionally |

### Step 5: Verify Fix Direction

Before editing, ask:

1. **"Was this test passing before?"**
   - If yes → something changed that broke it (find what)
   - If no → test may have always been wrong

2. **"Does the test expectation match the specification?"**
   - Read comments, docs, or ask the user
   - If test expects wrong thing → fix test
   - If service does wrong thing → fix service

3. **"What would a user experience?"**
   - If service behavior would break user experience → fix service
   - If service behavior is correct but test is wrong → fix test

## Decision Framework

```
Failing Test
     │
     ├─→ Does service do the RIGHT thing?
     │         │
     │         ├─→ YES: Fix the test (wrong expectation)
     │         │
     │         └─→ NO: Fix the service
     │
     ├─→ Does test provide everything service needs?
     │         │
     │         ├─→ NO: Fix test mocks (incomplete setup)
     │         │
     │         └─→ YES: Continue investigating
     │
     └─→ Does test run correctly in isolation?
               │
               ├─→ NO: Test has internal issues
               │
               └─→ YES: Mock state pollution between tests
```

## Common Patterns and Fixes

### Pattern 1: Mock Missing Methods

**Symptom**: `TypeError: x.method is not a function`

**Root cause**: Mock object doesn't include all methods the service uses.

**Fix**: Add missing methods to mock, not remove the service call.

```javascript
// ❌ DON'T: Remove the service call or try-catch it
// ✅ DO: Add the method to the mock
mockObject.missingMethod = vi.fn().mockResolvedValue(expectedValue);
```

### Pattern 2: Assertion Mismatch

**Symptom**: `expected X to be Y`

**Investigation**:
1. Is X (actual) correct? → Fix test to expect X
2. Is Y (expected) correct? → Fix service to return Y
3. Did behavior intentionally change? → Update test with explanation

```javascript
// ✅ If updating test expectation, explain WHY
// The algorithm finds globally optimal pairings via cross-matching,
// so 2 pairs are linked, not 1 as originally expected
expect(result.pairsLinked).toBe(2);
```

### Pattern 3: Console/Logger Mismatch

**Symptom**: `expected console.error to be called` but it wasn't

**Root cause**: Code uses structured logger (pino, winston) not console.

**Fix**: Don't spy on console; verify functional behavior instead.

```javascript
// ❌ DON'T
expect(consoleSpy).toHaveBeenCalled();

// ✅ DO: Test the actual behavior
expect(result).toHaveLength(0); // Graceful degradation on error
```

### Pattern 4: Mock State Pollution

**Symptom**: Tests pass alone, fail together

**Root cause**: `vi.clearAllMocks()` doesn't reset `mockImplementation()`

**Fix**: Reset implementations in beforeEach (see vitest-mock-implementation-persistence skill)

## Verification Checklist

Before committing fixes:

- [ ] All tests pass: `npm run test`
- [ ] Fix addresses root cause, not symptoms
- [ ] No test assertions were weakened (removed checks, loosened expectations)
- [ ] If test expectation changed, there's a comment explaining why
- [ ] Service code unchanged unless there was a real service bug
- [ ] Fix is the minimal change needed

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | What to Do Instead |
|--------------|--------------|-------------------|
| Changing assertion to match output | Hides real bugs | Verify which is correct |
| Adding `.optional()` or `?` to make types pass | Masks null safety issues | Fix the null case properly |
| Wrapping in try-catch and ignoring | Swallows real errors | Fix why error occurs |
| Removing the failing test | Loses coverage | Fix the test or service |
| Adding `skip` or `todo` | Technical debt | Fix now or create ticket |
| Mocking more to avoid failures | Tests become meaningless | Mock only what's necessary |

## Example: Complete Debug Session

**Failing test**: "should sync accounts and transactions successfully"
**Error**: `expected undefined to be 1`

**Step 1 - Read both sides**:
- Test mocks `$transaction` to call callback with `prismaMock`
- Service uses `tx.account.update()` inside transaction
- Previous test set custom `mockImplementation` with limited object

**Step 2 - Trace execution**:
- Test A sets `$transaction.mockImplementation` → limited mock
- `vi.clearAllMocks()` runs → clears history, NOT implementation
- Test B runs → gets Test A's limited mock → fails

**Step 3 - Verify hypothesis**:
- Run Test B alone → passes ✓
- Run Test A then Test B → fails ✓
- Hypothesis confirmed: mock state pollution

**Step 4 - Classify**: Test bug (incomplete mock reset)

**Step 5 - Fix**: Add implementation reset to `beforeEach`

```javascript
beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((callback) => {
    return typeof callback === 'function'
      ? callback(mockPrisma)
      : Promise.resolve(callback);
  });
});
```

**Result**: All 1063 tests pass, no service code changed.

## Notes

- This methodology takes longer upfront but prevents regression cycles
- When in doubt, ask the user/team what the correct behavior should be
- Document your reasoning when changing test expectations
- The goal is confidence in the test suite, not just green checkmarks

## Related Skills

- vitest-mock-implementation-persistence: Specific fix for mock state pollution
- ai-agent-debugging-guide: General debugging strategies for confusing issues
