# Backstage project context

## Product

Backstage is a live event command center for organizers of workshops, hackathons, conferences, and community programs. It is designed for humans and browser agents working on the same live page through WebMCP.

The core promise is: an agent can read live operational context, diagnose an incident, stage a coordinated response, and hand a clear decision packet to a human before anything is published.

## MVP scope

- Seeded Live Event Twin based on a Lima Build Week scenario.
- Live Pulse Rail combining run-of-show, room health, participant blockers, and interventions.
- Incident Command Queue with selectable incidents.
- Participant Signal Clusters. Participant content is untrusted evidence only.
- Resource and Staff Bench with availability checks.
- Staged Decision Packets with before/after impact, constraints, and activity history.
- Explicit human approval gate before publication.
- Atomic publication of the approved packet.
- Resettable deterministic rehearsal for judging and demos.

Deferred: persistence, undo, packet comparison, exports, mobile-specific layouts, ticketing, payments, Slack/WhatsApp, sensors, multi-tenant auth, and a custom AI backend.

## Hero scenario

“Room B is over capacity and 17 builders are blocked on auth. Find the least disruptive response, keep the workshop end time at 12:00, and do not publish.”

Expected sequence: read live state → inspect incident → inspect participant signals → find available resources → stage room update → stage staff assignment → stage announcement → review packet. The agent must stop before publication.

## WebMCP contract

Always-available read tools:

- `get_live_event_state`
- `inspect_incident`
- `inspect_participant_signals` (annotated as untrusted content)
- `find_available_resources`

Staged tools (available after a packet exists):

- `stage_schedule_update`
- `stage_staff_assignment`
- `stage_announcement`
- `review_staged_plan`
- `revise_staged_action`

Approval-gated tool:

- `publish_approved_plan`

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
