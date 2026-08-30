# Backstage project context

## Product

Backstage is a live event command center for organizers of workshops, hackathons, conferences, and community programs. It is designed for humans and browser agents working on the same live page through WebMCP.

The core promise is: an agent can read live operational context, diagnose an incident, stage a coordinated response, and hand a clear revision-bound response to a human before anything is applied.

## MVP scope

- Seeded Live Event Twin based on a Lima Build Week scenario.
- Live Pulse Rail combining run-of-show, room health, participant blockers, and interventions.
- Incident Command Queue with selectable incidents.
- Participant Signal Clusters. Participant content is untrusted evidence only.
- Resource and Staff Bench with availability checks.
- Staged Decision Packets with before/after impact, constraints, and activity history.
- Explicit human approval gate before application.
- Atomic application of the approved response to simulated destinations.
- Stale-state rejection, coordinated re-planning, and exact rollback.
- Resettable deterministic rehearsal for judging and demos.

Deferred: persistence, packet comparison, exports, ticketing, payments, Slack/WhatsApp, sensors, multi-tenant auth, and a custom AI backend.

## Hero scenario

“Resolve the three-seat overflow and 17 sign-in blockers. One attendee needs a step-free route. Keep the 12:00 end time and respect Studio C’s 11:50 rehearsal. Draft the least disruptive response, but do not apply it.”

Expected sequence: read live state → inspect incident → inspect participant signals → find available resources → stage one response → review it. The agent must stop before application. A judge can then inject a live room conflict; the agent re-reads state and atomically revises room, time, staff, and notice before fresh approval.

## WebMCP contract

Always-available read tools:

- `get_live_event_state`
- `inspect_incident`
- `inspect_participant_signals` (annotated as untrusted content)
- `find_available_resources`

Draft tools:

- `stage_decision_packet` (before a response exists)
- `review_staged_plan`
- `update_draft_response` (staged only)

Approval-gated tool:

- `apply_approved_response`

Post-application tool:

- `revert_applied_response`

Tools are registered through `document.modelContext.registerTool`, use narrow JSON schemas, bounded outputs, shared validation logic, and AbortController cleanup. Keep the normal human UI useful when WebMCP is unavailable. Do not expose a hidden autonomous path.

## Judging priorities

Optimize for the four equally weighted criteria: WebMCP Leverage, Execution, Potential Impact, and Creativity & Ambition. The submission must stand alone through its live URL, public source repository, README, and short demo video.

## UI direction

The product should feel like a dense but calm live production desk: dark layered surfaces, low-contrast borders, lime for live/positive state, amber for attention, coral for critical state, Manrope for interface hierarchy, and JetBrains Mono for operational metadata. The focal element is the staged Decision Packet, not a generic chat panel.

## Development commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

When changing behavior, update `docs/USER_FLOWS.md` and `docs/EVALS.md` if the WebMCP contract or judge flow changes.
