# Backstage

Backstage is a constraint-aware recovery workspace for live events. A browser agent reads the same operational page as an organizer, connects evidence across incidents and resources, and stages one revision-bound **Draft Response**. The organizer sees the reasoning, alternatives, and exact proposed changes before anything can be applied.

This challenge submission is a deterministic Lima Build Week rehearsal built with the imperative WebMCP API. It runs entirely in the browser with fictional data.

## The problem

During a workshop, an organizer normally has to cross-check occupancy, attendee reports, accessibility needs, room schedules, and staff availability while the event keeps changing. A normal dashboard displays those facts, but the human still has to assemble and re-check the response manually.

Backstage exposes that existing page state as narrow WebMCP tools. The browser agent can investigate and coordinate a response from a natural-language goal while the application keeps validation and final authority.

## The judge scenario

At 11:18:

- Room B has 63 attendees and 60 seats.
- 17 attendees report that they cannot sign in to the workshop exercise.
- One affected attendee needs a step-free route.
- Studio C is the closest valid room, but must clear by 11:50 for a keynote rehearsal.
- Luis has authentication expertise, but is only available until 11:50.
- Atrium Annex is a later step-free fallback; Breakout Room A is too small and stairs-only.
- The workshop must still end at 12:00.

Ask a WebMCP-compatible browser agent:

> Resolve the three-seat overflow and 17 sign-in blockers. One attendee needs a step-free route. Keep the 12:00 end time and respect Studio C's 11:50 rehearsal. Draft the least disruptive response, but do not apply it.

The initial response uses Studio C from 11:25–11:45 and assigns Luis. It moves only the 20 affected attendees instead of disrupting the full room.

Then select **Inject live conflict**. Studio C is claimed early and the event state advances from v1 to v2. The old response becomes visibly stale, any approval is invalidated, and apply remains unavailable. A valid re-plan coordinates both dependencies: Atrium Annex from 11:30–11:55 and Inés, who remains available after Luis's handoff.

The organizer approves the exact new revision and applies it to three simulated in-app destinations:

- Event room board
- Staff briefing view
- Attendee notice preview

Every receipt carries the approved revision ID. **Revert response** restores the exact pre-application event state and requires fresh approval.

No email, Slack message, physical room change, or external notification is sent.

## Why WebMCP is material

| Without WebMCP | With Backstage WebMCP |
| --- | --- |
| The organizer manually cross-checks four views and translates a decision into several edits. | One goal triggers bounded reads across the same live page and produces one coordinated draft. |
| A stale room or staff choice is easy to miss while the event changes. | Drafts carry an event-state version; stale responses fail closed and must be re-planned. |
| Approval can be ambiguous after an edit. | Approval is bound to a deterministic revision ID and disappears after any revision. |
| Individual edits can leave partial operational state. | The approved response applies atomically and returns revision-bound receipts. |

WebMCP is not being used as a remote-control shortcut or a chat widget. Its advantage is typed, state-aware access to an existing human workflow. The normal UI remains fully useful when WebMCP is unavailable; **Preview without agent** exercises the same draft transition for judges without a compatible agent.

## Human and agent flow

1. The agent calls `get_live_event_state` and inspects the two related incidents.
2. Participant reports are read as explicitly untrusted evidence, never instructions.
3. The agent checks current room access, capacity, turnover, staff skills, and availability.
4. `stage_decision_packet` creates a visible draft and changes no operational state.
5. The organizer reviews evidence, rejected alternatives, constraints, and action cards.
6. `update_draft_response` revises coordinated fields atomically and creates a new revision.
7. The organizer approves the exact visible revision.
8. Only then does `apply_approved_response` exist for the agent.
9. The response updates the simulated board atomically and returns stable receipts.
10. `revert_applied_response` restores the exact previous demo state if needed.

## WebMCP contract

Tools are registered through `document.modelContext.registerTool`. Availability changes with the response lifecycle so an agent cannot select a capability that should not exist in the current state.

| Tool | Availability | Contract |
| --- | --- | --- |
| `get_live_event_state` | always | Bounded event version, sessions, occupancy, incidents, and trusted organizer constraints |
| `inspect_incident` | always | Exact ID only; unknown IDs return recovery guidance |
| `inspect_participant_signals` | always | Participant text is marked untrusted and returned as evidence only |
| `find_available_resources` | always | Current rooms and staff with access, capacity, skills, and availability windows |
| `stage_decision_packet` | before a response exists | Creates a draft; changes no live state and sends nothing |
| `review_staged_plan` | staged or approved | Returns the exact revision, evidence, alternatives, validation, and approval state |
| `update_draft_response` | staged only | Atomically revises room, time, staff, audience, or notice; re-bases state and invalidates approval |
| `apply_approved_response` | exact revision approved only | Applies to the demo board and returns revision-bound in-app receipts |
| `revert_applied_response` | applied and reversible only | Restores the pre-application demo state and requires fresh approval |

The adapter uses strict schemas and enums, bounded outputs, explicit recovery errors, shared validation, lifecycle-aware registration, `AbortController` cleanup, security annotations, and `untrustedContentHint` for participant reports. A collapsible flight recorder shows successful and rejected calls.

## Two-minute demo

1. Reset the page and read the conflicting constraints aloud.
2. Give the browser agent the prompt above.
3. Show the initial Studio C + Luis draft, trusted/untrusted evidence, and rejected alternatives.
4. Point out that apply is absent because no human has approved the draft.
5. Inject the live room conflict. Show the stale-state error and locked approval.
6. Ask the agent: “Re-inspect resources and revise this response against the current event state. Do not apply it.”
7. Show the new Atrium Annex + Inés revision and approve it in the UI.
8. Ask the agent to apply the approved response.
9. Show all three receipts with the same revision ID.
10. Revert and show that the prior state returns and approval is required again.

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

Open the Vite URL in a WebMCP-compatible browser or agent. Reset restores the known starting state.

## Evaluation evidence

`npm test` runs deterministic tests for:

- access, capacity, room turnover, staff skill, and staff-window constraints;
- stale event-state detection and coordinated fallback re-planning;
- exact revision approval and invalidation after edits;
- strict IDs, time formats, and recovery errors;
- lifecycle-aware WebMCP schemas and tool availability;
- atomic application, stable receipts, and rollback.

[`evals/webmcp-journeys.json`](./evals/webmcp-journeys.json) contains ten public model-eval fixtures based on Chrome's WebMCP eval guidance. They cover direct and open-ended selection, read-only intent, untrusted content, invalid-ID recovery, inaccessible-resource rejection, stale-state re-planning, exact-revision approval, and rollback.

These are eval inputs and deterministic contract tests, **not claimed model pass rates**. Measured multi-model scores should only be published after running the suite with the submission's target browser agents.

## Honest scope

This proves the human–agent interaction and recovery contract, not a production event platform. State is in memory; there is one seeded organizer view; identities and resources are fictional; delivery receipts are simulated in-app. Production work would require authentication, role-based authorization, persistence, real delivery adapters, telemetry, and field testing.

Those boundaries are visible in the product. Backstage does not imply that it contacted staff, moved a physical room, or sent a participant message.

## References

- [WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Official challenge rules and judging criteria](https://webmcp.devpost.com/rules)
- [Chrome: build agentic workflows with WebMCP](https://developer.chrome.com/docs/ai/webmcp/build-tools)
- [Chrome: WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Chrome: evals for WebMCP](https://developer.chrome.com/docs/ai/webmcp/evals)

## License

MIT — see [LICENSE](./LICENSE).
