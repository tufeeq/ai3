# TAGX3 Validation Scorecard

Generated: 2026-09-01T21:05:16.967Z
Status: **MEASURING**
Sessions: **3** · Snapshots: **54**
Cadence: target **15m** · median **34.7855m** · max **275.0846m** · excessive gaps **16** · healthy **no** · scope **active-market within-session** · closed snapshots ignored **26** · outside-window snapshots ignored **2** · cross-session gaps ignored **1**

> Measurement only. No production thresholds are changed and no trading edge is claimed.

| Horizon | Valid | Flat | 1-point path | Source shift | Live-backed shift | Movers | Detected | Capture | Missed | False positive | Avg detected MFE | Avg detected MAE |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 15m | 7043 | 8.1% | 100.0% | 2.9% | 0.0% | 5 | 33 | 0.0% | 100.0% | 90.9% | -0.26% | -0.26% |
| 30m | 21658 | 66.5% | 100.0% | 6.0% | 0.0% | 43 | 282 | 14.0% | 86.1% | 95.0% | 0.43% | 0.43% |
| 120m | 37906 | 59.3% | 97.9% | 8.7% | 0.0% | 148 | 583 | 24.3% | 75.7% | 90.0% | 8.12% | 7.23% |

## Readiness note

Snapshot cadence is incomplete (16 active-market within-session gap(s) above 24 minutes). Repair measurement coverage before interpreting model performance.

