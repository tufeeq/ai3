# TAGX3 Validation Scorecard

Generated: 2026-09-01T23:24:37.977Z
Status: **MEASURING**
Sessions: **3** · Snapshots: **57**
Cadence: target **15m** · median **38.2545m** · max **275.0846m** · excessive gaps **19** · healthy **no** · scope **active-market within-session** · closed snapshots ignored **26** · outside-window snapshots ignored **2** · cross-session gaps ignored **1**

> Measurement only. No production thresholds are changed and no trading edge is claimed.

| Horizon | Valid | Flat | 1-point path | Source shift | Live-backed shift | Movers | Detected | Capture | Missed | False positive | Avg detected MFE | Avg detected MAE |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 15m | 7043 | 8.1% | 100.0% | 2.9% | 0.0% | 5 | 33 | 0.0% | 100.0% | 90.9% | -0.26% | -0.26% |
| 30m | 29020 | 54.5% | 100.0% | 6.0% | 0.0% | 62 | 413 | 17.7% | 82.3% | 93.0% | 28.06% | 28.06% |
| 120m | 38562 | 59.9% | 98.0% | 8.6% | 0.0% | 148 | 629 | 24.3% | 75.7% | 90.3% | 7.55% | 6.73% |

## Readiness note

Snapshot cadence is incomplete (19 active-market within-session gap(s) above 24 minutes). Repair measurement coverage before interpreting model performance.

