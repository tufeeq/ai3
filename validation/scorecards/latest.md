# TAGX3 Validation Scorecard

Generated: 2026-09-03T04:30:58.034Z
Status: **MEASURING**
Sessions: **5** · Snapshots: **87**
Cadence: target **15m** · median **42.8187m** · max **275.0846m** · excessive gaps **29** · healthy **no** · scope **active-market within-session** · closed snapshots ignored **37** · outside-window snapshots ignored **5** · cross-session gaps ignored **2**

> Measurement only. No production thresholds are changed and no trading edge is claimed.

| Horizon | Valid | Flat | 1-point path | Source shift | Live-backed shift | Movers | Detected | Capture | Missed | False positive | Avg detected MFE | Avg detected MAE |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 15m | 14672 | 55.9% | 100.0% | 1.4% | 0.0% | 5 | 153 | 0.0% | 100.0% | 98.0% | -0.06% | -0.06% |
| 30m | 49817 | 61.2% | 98.9% | 3.9% | 0.0% | 87 | 711 | 25.3% | 74.7% | 92.7% | 16.71% | 16.71% |
| 120m | 89762 | 67.5% | 95.7% | 5.7% | 0.0% | 209 | 1542 | 23.4% | 76.6% | 93.1% | 17.90% | 17.57% |

## Readiness note

Snapshot cadence is incomplete (29 active-market within-session gap(s) above 24 minutes). Repair measurement coverage before interpreting model performance.

