# Pathway

Pathway turns an open learning goal into a source-backed path the learner can inspect, revise, and approve. It does more than find a course: it coordinates resources across sources, orders them around real constraints, and ends each stage with something the learner can show.

The current demo has curated resource coverage for two visible domains:

- **Commercial photography** — the primary judge scenario, including food photography for local cafés.
- **Inclusive workshop facilitation** — a non-technical transition path.

It does **not** claim to plan every topic. A learner starts with an open-ended goal; the app tells them whether its current catalog covers that goal before a draft is created. The catalog is deterministic so the demo is fast, repeatable, and honest about its limits.

## Why this needs WebMCP

A normal chat agent can suggest links. It cannot reliably coordinate the actual constraints, source records, draft revision, visible schedule, progress, and human approval state on a product page.

Pathway exposes those real objects through WebMCP. An agent can turn a natural-language request into coordinated filters for:

- what the learner already knows;
- Spanish or English resources;
- free-only or budget-capped options;
- available weeks and hours for the plan;
- prerequisite checks before approval;
- asynchronous access; and
- preferred format such as guide, course, exercise, project, or video.

The result is visible in the normal interface as a **Learn → Practice → Produce** route. Every step includes a concrete deliverable, such as a food-lighting study or a client-ready portfolio story.

## Primary demo

The site opens empty. For the deterministic judge walkthrough, click **Load example** or give the same request to a WebMCP-compatible browser agent:

> I manage social media for my family’s café and want to start taking paid food photography work for local restaurants. In eight weeks, I need a client-ready portfolio and a one-page client brief. I know basic photo editing, can study five hours a week, have $100, prefer Spanish, and need async resources. Search first; do not build a path yet.

The agent calls `prepare_learning_search`, which makes the translated query, coordinated search preferences, plan limits, catalog-coverage match, and cross-source shortlist visible. The learner reviews that shortlist, optionally compares sources, then asks the agent to create the draft from those reviewed resources. The draft has five stages, a skill-gap summary, source provenance, constraint checks, portfolio evidence, and a balanced weekly schedule.

Then ask:

> The learner is now comfortable with English and prefers guides. Revise the draft, but do not approve it.

The page gets new source choices, a new revision, and a new schedule. The human must review it. The agent has no approval or save tool.

After the human approves and saves with the normal UI, ask:

> The learner completed the first saved step. Record that progress and replan only the remaining weeks. Do not approve or save the replacement draft.

Completed work remains locked. Only unfinished work is replanned, and the new revision again waits for human approval.

## WebMCP contract

Tools are registered dynamically with `document.modelContext.registerTool` and strict, bounded schemas.

| Tool | When available | Purpose |
| --- | --- | --- |
| `get_learning_context` | Always | Read constraints, skill gap, progress, path state, and catalog coverage. |
| `prepare_learning_search` | Before a draft exists | Translate a natural-language goal into the visible query, filters, and resource shortlist. |
| `search_learning_resources` | Always | Apply structured filters to the current path's catalog. External source data is untrusted. |
| `inspect_learning_resource` | Always | Inspect one exact resource and open its source details, including URL and provenance. |
| `compare_learning_resources` | Always | Compare two or three exact resources and open the same comparison panel shown to the learner. |
| `build_learning_path` | After search review | Create an ordered draft with its weekly schedule from the visible shortlist. |
| `revise_learning_path` | Draft only | Rebuild a draft after a learner constraint changes. |
| `update_learning_progress` | Saved path only | Store an ordered batch of completed steps locally. |
| `replan_remaining_path` | Saved path with progress | Rebuild only unfinished weeks as a new draft. |

Only the human interface can approve and save. Pathway never enrolls, purchases, contacts a provider, sends messages, or copies provider content.

## Data and source honesty

The catalog is a manual snapshot with original provider links. Its duration and price are clearly marked planning estimates, and some discovery links are labeled **curated starting point** rather than authoritative course listings. A production version would need permitted provider feeds or APIs and ongoing metadata verification.

The demo intentionally makes no provider API call and does not scrape websites. That is why it responds immediately: WebMCP queries the prepared resource data already on the page, not the open web.

## Run

```bash
npm install
npm run dev
```

Open the local URL in a WebMCP-compatible browser to use the agent tools. The full normal interface works in any modern browser.

```bash
npm run typecheck
npm test
npm run build
```

## Evaluation scope

[`evals/webmcp-journeys.json`](./evals/webmcp-journeys.json) contains deterministic evaluation fixtures for tool selection, filter use, external-data safety, recovery, revision behavior, human approval boundaries, progress ordering, and full-path completion. They are test scenarios, not claimed model scores.

## License

MIT — see [LICENSE](./LICENSE).
