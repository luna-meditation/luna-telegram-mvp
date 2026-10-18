# Luna Intelligence 1.0 — model evidence

2026-10-18, existing isolated staging; 50 tasks, alternating 25 RU / 25 EN, same exact inputs and tool schemas for all three models. No production records. Provider budget shared with real application smoke: 180 calls / $1 maximum.

| Model | Raw first-call expected tool match | Arguments | Language | Completed | Cost for 50 | Median / p95 latency |
| --- | --- | --- | --- | --- | --- | --- |
| gpt-5-mini | 37/50 | 50/50 | 50/50 | 50/50 | $0.01993025 | 1503 / 6253 ms |
| gpt-4.1-mini | 29/50 | 50/50 | 50/50 | 50/50 | $0.05902840 | 1411 / 2244 ms |
| gpt-4o-mini | 44/50 | 50/50 | 50/50 | 50/50 | $0.02318265 | 952 / 3426 ms |

Cost is actual reported input/cached/output usage at published pricing, including warm cache effects; it is not a guaranteed price for a future conversation. Tool lookup can legitimately precede a final action, so this strict first-decision metric is not a user journey success rate. Likewise, language detection and valid arguments do not prove naturalness or correct facts.

Manual findings: GPT-5-mini sometimes promises navigation without a tool, chooses breathwork for a quiet meditation, invents earning activities when not retrieving the catalog, and overexplains a requested single step. GPT-4.1-mini has more promises without execution and falsely offers Human Design calculation. GPT-4o-mini is fast and often selects a tool, but invents unsupported Russian-audio availability and earning mechanisms. No candidate is safe as an unconstrained action engine. Production stays on GPT-5-mini with the existing $100 cap; no automatic expensive routing.

Runtime corrections are independent of model prose: high-confidence explicit commands execute via verified owner-bound services; ambiguous general requests use structured tools rather than legacy meditation keywords; navigation has real allowlisted destinations; unsupported files/calculation engines answer honestly before a provider call; unverified financial/memory/playback/navigation acknowledgements fail without consuming a successful-answer allowance. Complete historical replies retain a free expandable detail view.

Before/after examples, backed by tests: "Draw five Tarot cards" formerly redirected toward history; now prepares exactly five selectable backs in the current chat. "Let's breathe one minute" formerly dispatched to another page; now uses the existing real elapsed-time session in chat. "Help me choose a prototype step" initially triggered a stale meditation clarification; the corrected request must answer the prototype goal, with no meditation card. This last correction requires a separate real staging check before release.

The corrected-topic staging check subsequently passed. Total paid usage: 158 calls / $0.1144434, including the initial failed-semantic response (not hidden or refunded in this accounting). Saved reopens use 0 provider calls. Observed GPT-5-mini costs: 1-card $0.000859, 3-card $0.0015065, 5-card $0.001936, Tarot follow-up $0.002611, compatibility $0.00164265, natal $0.00170975, corrected ordinary chat $0.00080565. Ordinary corrected input 4461 tokens / 2816 cached, output 162. Personal context retrieval in the Tarot follow-up measured 315 characters (105 estimated tokens), 1133 ms. No new deep-analysis price/cost benchmark or real transcription was purchased in this program. All eight real smoke replies used provided context or deterministic actions without a paid tool continuation; separate first-decision tool-selection latency and local execution tests must not be misrepresented as measured full tool-loop overhead.

Private synthetic raw outputs and exact usage are retained in the finite staging QA report. No invented numeric personalization/naturalness score is published.
