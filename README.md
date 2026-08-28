# Backstage

Backstage is a live event command center for organizers running workshops, hackathons, and community programs. It is designed around the WebMCP promise: a human and a browser agent can work on the same live page, with the agent reading trusted operational context, staging a response, and handing control back before publication.

## Why this is a strong WebMCP submission

- **WebMCP leverage:** tools are state-aware and progressive. Read tools and initial packet staging are always available; packet-editing tools appear after staging; the destructive publication tool appears only after explicit human approval.
- **Execution:** a deterministic Lima Build Week event twin makes the hero scenario replayable. The UI, fallback rehearsal button, and agent tools all call the same validated state transitions.
- **Impact:** event teams in Latin America often coordinate rooms, mentors, and participant support with fragmented chat and spreadsheets. Backstage turns those signals into a reviewable operational decision.
- **Creativity and ambition:** the signature Live Pulse Rail combines run-of-show, participant blockers, room health, and staged interventions into one chronological surface instead of a generic chatbot.
- **Proof over guesswork:** every packet carries source provenance, trusted/untrusted labels, alternatives considered, constraint checks, and measurable impact before a human can approve it.

## Run locally

```bash
npm install
npm run dev
```

For a production check:

```bash
npm run typecheck
npm test
npm run build
```

To test tools, use Chrome 149+ with the WebMCP flag enabled or the ChatGPT browser. The app includes a **Run rehearsal** fallback so the full state transition is also demonstrable without a connected agent.

## Human-led demo

This is a deterministic rehearsal, not an integration that sends email, edits a flyer, moves a real room, or messages participants. **Reset demo** restores the fictional Lima Build Week event twin. A **Decision Packet** is a proposed set of room, staffing, and participant-update changes. **Approve packet** is the human sign-off; **Publish to event twin** applies that approved proposal only to the simulated state on this page.

1. Click **Reset demo**, then read the incident queue: Room B has 63 people for 60 seats and 17 builders are blocked on authentication.
2. Click **Run rehearsal** (or ask the browser agent to use the prompt below). The proposal appears; live state is unchanged and publishing is unavailable.
3. Walk the packet top to bottom: evidence explains *why* the proposal exists, alternatives explain *why this option* was selected, and the impact strip quantifies the result.
4. Say, “Use Inés Paredes instead of Luis, but keep the overflow room.” The agent revises the staff card while the proposal remains staged.
5. As the human, click **Approve packet**. Only now does **Publish to event twin** appear.
6. Click **Publish to event twin** and point out the simulated result: Huddle 1 is marked in use, the selected staff member is assigned there, addressed incidents move to monitoring, and the flight recorder keeps the trail.

Agent prompt:

> Room B is over capacity and 17 builders are blocked on auth. Find the least disruptive response, keep the workshop end time at 12:00, and do not publish.

The agent should stop after staging and reviewing. The human—not the agent—decides whether the proposal is approved and applied.

The incident queue also supports a second rehearsal path: select **17 participants blocked on auth** and choose **Stage response for this incident** to stage a Studio C support clinic with Inés Paredes. This demonstrates that the packet is derived from incident context rather than being a single fixed answer.

## WebMCP tools

| Tool | Mode | Guardrail |
| --- | --- | --- |
| `get_live_event_state` | read | bounded event snapshot |
| `inspect_incident` | read | requires incident id |
| `inspect_participant_signals` | read | participant text marked untrusted |
| `find_available_resources` | read | only available rooms/staff |
| `stage_decision_packet` | stage | creates the initial packet (optionally for an incident id); no publication or notification |
| `stage_schedule_update` | stage | no publication or notification |
| `stage_staff_assignment` | stage | rejects unavailable staff |
| `stage_announcement` | stage | message remains unsent |
| `review_staged_plan` | read | returns constraints + validation |
| `revise_staged_action` | stage | keeps edit visible in packet |
| `publish_approved_plan` | publish | registered only after human approval |

The adapter uses `document.modelContext.registerTool`, an `AbortController` for cleanup, narrow JSON Schemas, bounded outputs, and shared app logic. This keeps the page useful to humans when WebMCP is unavailable and avoids a separate AI backend.

The Decision Packet is intentionally proof-carrying: evidence sources are shown with provenance and trust level, rejected alternatives explain the trade-off, and the impact strip reports affected participants, capacity relief, staging time, and constraint checks. The Agent flight recorder captures tool names, inputs, outcomes, and rejected attempts so a judge can replay the human/agent handoff instead of taking a narrated result on faith.

## Judging-ready notes

The public demo should show the live URL, the normal human interface, at least one agent journey, the staged packet, the approval gate, and the post-publication state. Judges should be able to understand the product from this README, the UI labels, and the three-minute video without hidden setup.

## Scope and next steps

The MVP intentionally does not connect to ticketing, Slack/WhatsApp, payments, sensors, or a custom model API. Those integrations can follow after the interaction contract is proven. A future release can add persistence, packet comparison, undo, export, and multi-event support.

## License

MIT — see [LICENSE](./LICENSE).
