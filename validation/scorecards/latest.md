# TAGX3 Validation Scorecard

Generated: 2026-09-02T16:42:24.322Z
Status: **MEASURING**
Sessions: **4** · Snapshots: **73**
Cadence: target **15m** · median **42.8187m** · max **275.0846m** · excessive gaps **23** · healthy **no** · scope **active-market within-session** · closed snapshots ignored **34** · outside-window snapshots ignored **4** · cross-session gaps ignored **2**

> Measurement only. No production thresholds are changed and no trading edge is claimed.

| Horizon | Valid | Flat | 1-point path | Source shift | Live-backed shift | Movers | Detected | Capture | Missed | False positive | Avg detected MFE | Avg detected MAE |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 15m | 7043 | 8.1% | 100.0% | 2.9% | 0.0% | 5 | 33 | 0.0% | 100.0% | 90.9% | -0.26% | -0.26% |
| 30m | 35502 | 62.8% | 100.0% | 4.9% | 0.0% | 62 | 472 | 17.7% | 82.3% | 93.9% | 24.55% | 24.55% |
| 120m | 60324 | 54.6% | 96.8% | 7.0% | 0.0% | 189 | 986 | 24.9% | 75.1% | 90.7% | 28.09% | 27.57% |

## Readiness note

Snapshot cadence is incomplete (23 active-market within-session gap(s) above 24 minutes). Repair measurement coverage before interpreting model performance.

