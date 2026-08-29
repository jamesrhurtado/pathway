# Backstage

Backstage is an agent-assisted incident response board for live events. A browser agent investigates a messy operational problem and assembles one evidence-backed **Draft Response**; the organizer reviews, edits, and approves it before any state changes.

The submission is a deterministic Lima Build Week rehearsal built with the imperative WebMCP API. It runs entirely in the browser and uses fictional data.

## The three-minute story

Room B has 63 people but only 60 seats. At the same time, 17 attendees report that they cannot sign in to the workshop exercise. A spare classroom and support staff are available, but the workshop must still end at 12:00.

Ask a WebMCP-compatible browser agent:

> Seat the three standing attendees and help the 17 people who cannot sign in. Keep the 12:00 end time. Draft the least disruptive response, but do not apply it.

The agent reads the current event, inspects trusted and untrusted evidence, finds available resources, and stages a coordinated room/staff/notice response. It must stop. The organizer can revise the visible draft, approve it, and apply it to the demo. The result appears as three explicit in-app receipts:

- Event room board: the spare classroom is reserved.
- Staff briefing view: the selected support person is assigned.
- Attendee notice preview: the exact affected-audience message is shown.

No email, Slack message, physical room change, or external notification is sent.

## Why WebMCP materially improves this product

A normal operations UI makes an organizer manually inspect incidents, participant reports, room availability, staff availability, and schedule constraints across separate panels. WebMCP turns that cross-panel investigation into one natural-language request while preserving the same visible application state and human approval boundary.

The value is not a chatbot or a hidden autonomous workflow. It is a shared, editable operational artifact:

| Browser agent | Organizer | Application |
| --- | --- | --- |
| Reads and connects evidence across panels | Sets intent and constraints | Exposes narrow, state-aware tools |
| Drafts three coordinated changes | Reviews evidence and alternatives | Shows every proposed change before applying |
| Revises the draft on request | Approves and applies | Updates demo destinations atomically and records receipts |

The human UI remains fully useful without WebMCP. **Preview without agent** exercises the same state transition for judges who do not have a compatible agent connected.

## Run locally

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run typecheck
npm test
npm run build
```

Open the Vite URL in a WebMCP-compatible browser/agent. Reset restores the known starting state.

## WebMCP contract

Tools are registered with `document.modelContext.registerTool` and change with the packet lifecycle.

| Tool | Availability | Contract |
| --- | --- | --- |
| `get_live_event_state` | always | Bounded read of sessions, occupancy, health, and incident IDs |
| `inspect_incident` | always | Exact ID only; unknown IDs return recovery guidance |
| `inspect_participant_signals` | always | Participant text is annotated and returned as untrusted evidence |
| `find_available_resources` | always | Current available rooms and staff only |
| `stage_decision_packet` | before a draft exists | Creates a draft; changes no operational state |
| `review_staged_plan` | after staging | Returns the visible draft, constraints, and validation state |
| `stage_schedule_update` | while staged | Requires an available room and strict `HH:MM` window before 12:00 |
| `stage_staff_assignment` | while staged | Requires an exact currently available staff ID |
| `stage_announcement` | while staged | Requires a bounded, specific audience and message; sends nothing |
| `revise_staged_action` | while staged | Revises one exact visible action and keeps approval locked |
| `publish_approved_plan` | only after human approval | Applies the approved draft to the demo board and returns receipts |

The adapter uses narrow schemas and enums, explicit recovery errors, shared validation, `AbortController` cleanup, lifecycle-aware registration, read/destructive annotations, and `untrustedContentHint` for participant reports. An agent flight recorder makes successful and rejected calls visible.

## Evaluation evidence

`npm test` runs deterministic tests for state transitions, strict ID/time validation, resource availability, approval lifecycle, tool schemas, cleanup, and dispatch receipts.

[`evals/webmcp-journeys.json`](./evals/webmcp-journeys.json) is a public journey dataset following Chrome's WebMCP eval guidance. It covers:

- direct and open-ended tool selection;
- a multi-tool no-apply journey;
- read-only intent;
- untrusted participant content;
- invalid-ID recovery;
- the human approval gate.

The JSON cases are model-eval fixtures, not claimed model scores. The repository test verifies that every referenced tool exists and that the intended coverage remains complete.

## Honest scope

This version proves the human–agent interaction contract, not a production event platform. State is in memory; there is one operator view; identities are seeded; delivery receipts are simulated in-app. Production work would require authentication, persistence, authorization by event/role, adapter-backed delivery, telemetry, undo, and real-world testing.

That boundary is deliberate for the challenge: the live demo is deterministic, every action is inspectable, and no fake integration is presented as real.

## References

- [WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Official challenge rules and judging criteria](https://webmcp.devpost.com/rules)
- [Chrome: build agentic workflows with WebMCP](https://developer.chrome.com/docs/ai/webmcp/build-tools)
- [Chrome: WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Chrome: evals for WebMCP](https://developer.chrome.com/docs/ai/webmcp/evals)

## License

MIT — see [LICENSE](./LICENSE).
