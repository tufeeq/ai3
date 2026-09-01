# TAGX3 Validation Scorecard

Generated: 2026-09-01T14:27:23.205Z
Status: **MEASURING**
Sessions: **3** · Snapshots: **45**
Cadence: target **15m** · median **46.7315m** · max **275.0846m** · excessive gaps **10** · healthy **no** · scope **active-market within-session** · closed snapshots ignored **26** · outside-window snapshots ignored **2** · cross-session gaps ignored **1**

> Measurement only. No production thresholds are changed and no trading edge is claimed.

| Horizon | Valid | Flat | 1-point path | Source shift | Live-backed shift | Movers | Detected | Capture | Missed | False positive | Avg detected MFE | Avg detected MAE |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 15m | 0 | — | — | — | — | 0 | 0 | — | — | — | —% | —% |
| 30m | 14641 | 96.6% | 100.0% | 6.1% | 0.0% | 20 | 276 | 25.0% | 75.0% | 96.4% | 0.38% | 0.38% |
| 120m | 23877 | 91.9% | 96.7% | 10.4% | 0.0% | 102 | 571 | 33.3% | 66.7% | 91.2% | 8.23% | 7.33% |

## Readiness note

Snapshot cadence is incomplete (10 active-market within-session gap(s) above 24 minutes). Repair measurement coverage before interpreting model performance.

