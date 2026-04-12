# maintenance / Firestore readonly go-no-go 2026-04-09

## Current status

- Browser-list view mapping is fixed and already reused by the readonly reader, compare, and verify flow.
- `firestore-readonly` is already integrated into the maintenance north sync entry as a readonly candidate source.
- The existing `browser` sync path is still preserved as the current safe default.
- Snapshot-remap verification has already converged to zero compare differences.

## Why readonly candidate = yes

- The readonly source is already wired into the formal sync entry without replacing the browser path.
- Browser-list view compare has already converged under the accepted verify flow.
- Snapshot-remap verify result:
  - `mode = snapshot-remap`
  - `browserCount = 9`
  - `firestoreCount = 9`
  - `matchingCaseCount = 9`
  - `browserOnlyCount = 0`
  - `firestoreOnlyCount = 0`
  - `region different = 0`
  - `work_date different = 0`
  - `complete_date different = 0`

## Why safe default switch = no

- We still do not have one successful verify result with `mode = live-firestore`.
- The only blocker is operational, not mapping-related:
  - `FIREBASE_EMAIL` and `FIREBASE_PASSWORD` have not been present in the actual shell/host that runs verify.
- Because of that missing credential precondition, the last verify fell back to `snapshot-remap` and cannot be used as live go-ahead evidence.

## Go / no-go

- `readonly` formal candidate source: `yes`
- safe default switch to `firestore-readonly`: `no`
- recommendation for `MAINTENANCE_NORTH_SYNC_SOURCE` default today: keep `browser`

## Minimal safe switch plan

1. Keep `browser` as the current default.
2. Run one real live verify from the same shell/host that will be used operationally.
3. Only if that verify passes, switch `MAINTENANCE_NORTH_SYNC_SOURCE` to `firestore-readonly`.
4. Keep the `browser` path intact as rollback.

## Runbook

1. Put `FIREBASE_EMAIL` and `FIREBASE_PASSWORD` into the exact shell/host that will run verify.
2. Run `npm run verify:maintenance-firestore-readonly`.
3. Confirm these fields in the output:
   - `mode`
   - `browserCount`
   - `firestoreCount`
   - `matchingCaseCount`
   - `browserOnlyCount`
   - `firestoreOnlyCount`
   - `fieldAgreementSummary.region`
   - `fieldAgreementSummary.work_date`
   - `fieldAgreementSummary.complete_date`
4. If it fails, classify the first failure as one of:
   - `auth`
   - `firestore read`
   - `compare mismatch`
   - `other`

## Live pass criteria

The next live verify counts as pass only if all of the following are true:

- `mode = live-firestore`
- `browserCount = firestoreCount`
- `matchingCaseCount = 9`
- `browserOnlyCount = 0`
- `firestoreOnlyCount = 0`
- `region different = 0`
- `work_date different = 0`
- `complete_date different = 0`

## What changes to yes

The answer can change to "safe default switch = yes" only when the exact live verify above succeeds from the real execution shell/host with the pass criteria unchanged.
