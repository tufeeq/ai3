# TAGX 3.0 — Persistent Opportunity Intelligence

Clean rebuild of TAGX as an independent challenger architecture.

## What changed

TAGX3 is not a session scanner. It maintains persistent `OpportunityCase` state across minutes, hours, and sessions. The core lifecycle is:

`DISCOVERED → WATCH → ACCUMULATING → ARMED → IGNITING → EXPANDING → DISTRIBUTING → CLOSED`

Three independent engines feed an orchestrator:

- Reactive Engine — unexpected movement, velocity, liquidity, dislocation.
- Anticipatory Engine — scheduled catalysts and pre-event accumulation.
- Pattern & Memory Engine — former runners, sector lead-lag, persistent setup memory.

The liquidity lifecycle, feature half-life, catalyst clock, causal trace, data-confidence layer, Sharia intelligence, trade monitor, failure taxonomy, no-look-ahead replay, and champion/challenger rules are first-class concepts.

## Sharia policy

Sharia analysis is **parallel to market discovery**. `UNVERIFIED` never means non-compliant and never suppresses discovery. States:

- `VERIFIED`
- `LIKELY_COMPLIANT`
- `CONFLICT_REVIEW`
- `UNVERIFIED`
- `NON_COMPLIANT`

Only confirmed `NON_COMPLIANT` is excluded from the default Sharia-oriented opportunity list. Parser/data failures are explicitly reported as `UNVERIFIED`.

## My Trades

Any opportunity can be added with the trader's actual entry price, optional quantity and personal stop. The browser stores an immutable-ish entry snapshot and tracks current P/L, MFE, MAE, lifecycle, continuation, distribution risk, data quality and Sharia-state changes. It emits in-app alerts for meaningful thesis changes.

## Data integrity

The public web UI currently uses an explicit **legacy data bridge** to read public JSON feeds produced by the previous `tufeeq/ai` repository. This is a temporary data adapter only; TAGX3 code and state are isolated in this repository. Feed failures remain visible and are never replaced with fabricated data.

A production real-time connector should be promoted only after sandbox/challenger benchmarking, license review, causal timestamp review and before/after evidence.

## Model semantics

The displayed 0–100 values are experimental model indices. They are **not calibrated statistical probabilities** and are not profit guarantees. The engine never marks a case executable by itself.

## Development loop

`Observe → Remember → Anticipate → Detect → Cross-Validate → Challenge → Prioritize → Track → Reassess → Close → Replay → Learn`

No threshold/rule is promoted because of one anecdote. Failures are classified, turned into hypotheses, replayed causally, tested as challengers, and promoted only after multi-case / multi-session evidence.

## Local checks

```bash
npm run check
npm test
```

## Repository role

- `tufeeq/ai` remains historical baseline / TAGX2 champion and legacy data producer.
- `tufeeq/ai3` is TAGX3 clean challenger architecture.

Trading edge is not assumed. It must be demonstrated with causal out-of-sample session evidence.
