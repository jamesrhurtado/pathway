# Backstage

Backstage is a live event command center for organizers running workshops, hackathons, and community programs. It is designed around the WebMCP promise: a human and a browser agent can work on the same live page, with the agent reading trusted operational context, staging a response, and handing control back before publication.

## Why this is a strong WebMCP submission

- **WebMCP leverage:** tools are state-aware and progressive. Read tools and initial packet staging are always available; packet-editing tools appear after staging; the destructive publication tool appears only after explicit human approval.
- **Execution:** a deterministic Lima Build Week event twin makes the hero scenario replayable. The UI, fallback rehearsal button, and agent tools all call the same validated state transitions.
- **Impact:** event teams in Latin America often coordinate rooms, mentors, and participant support with fragmented chat and spreadsheets. Backstage turns those signals into a reviewable operational decision.
- **Creativity and ambition:** the signature Live Pulse Rail combines run-of-show, participant blockers, room health, and staged interventions into one chronological surface instead of a generic chatbot.

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

To test tools, use Chrome 149+ with the WebMCP flag enabled or the ChatGPT browser. Open the page, ask the agent to inspect the event, and use the exact prompt below. The app includes a **Run rehearsal** fallback so the full state transition is also demonstrable without a connected agent.

## Hero demo prompt

> Room B is over capacity and 17 builders are blocked on auth. Find the least disruptive response, keep the workshop end time at 12:00, and do not publish.

Expected behavior: the agent reads the live state, inspects the incident, reads untrusted participant clusters, checks rooms/staff, stages three coordinated actions, and stops. Nothing is published until the human clicks **Approve packet**, then **Publish to live event** (or the agent invokes `publish_approved_plan`).

The incident queue also supports a second rehearsal path: select **17 participants blocked on auth** and choose **Stage response for this incident** to stage a Studio C support clinic with Inés Paredes. This demonstrates that the packet is derived from incident context rather than being a single fixed answer.

## WebMCP tools

| Tool | Mode | Guardrail |
| --- | --- | --- |
| `get_live_event_state` | read | bounded event snapshot |
| `inspect_incident` | read | requires incident id |
| `inspect_participant_signals` | read | participant text marked untrusted |
| `find_available_resources` | read | only available rooms/staff |
| `stage_decision_packet` | stage | creates the initial packet; no publication or notification |
| `stage_schedule_update` | stage | no publication or notification |
| `stage_staff_assignment` | stage | rejects unavailable staff |
| `stage_announcement` | stage | message remains unsent |
| `review_staged_plan` | read | returns constraints + validation |
| `revise_staged_action` | stage | keeps edit visible in packet |
| `publish_approved_plan` | publish | registered only after human approval |

The adapter uses `document.modelContext.registerTool`, an `AbortController` for cleanup, narrow JSON Schemas, bounded outputs, and shared app logic. This keeps the page useful to humans when WebMCP is unavailable and avoids a separate AI backend.

## Judging-ready notes

The public demo should show the live URL, the normal human interface, at least one agent journey, the staged packet, the approval gate, and the post-publication state. Judges should be able to understand the product from this README, the UI labels, and the three-minute video without hidden setup.

## Scope and next steps

The MVP intentionally does not connect to ticketing, Slack/WhatsApp, payments, sensors, or a custom model API. Those integrations can follow after the interaction contract is proven. A future release can add persistence, packet comparison, undo, export, and multi-event support.

## License

MIT — see [LICENSE](./LICENSE).
