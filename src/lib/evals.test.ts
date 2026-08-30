import { describe, expect, it } from 'vitest'
import journeys from '../../evals/webmcp-journeys.json'

const knownTools = new Set([
  'get_live_event_state',
  'inspect_incident',
  'inspect_participant_signals',
  'find_available_resources',
  'stage_decision_packet',
  'review_staged_plan',
  'update_draft_response',
  'apply_approved_response',
  'revert_applied_response',
])

describe('WebMCP journey eval dataset', () => {
  it('covers selection, security, constraint, stale-state, lifecycle, and rollback cases', () => {
    expect(journeys).toHaveLength(10)
    const categories = new Set(journeys.map((journey) => journey.category))
    for (const category of ['end-to-end', 'security', 'constraint-validation', 'stale-state', 'state-lifecycle', 'rollback']) expect(categories.has(category)).toBe(true)
  })

  it('references only registered WebMCP tools', () => {
    for (const journey of journeys) {
      expect(journey.prompt.length).toBeGreaterThan(10)
      expect(journey.success.length).toBeGreaterThan(10)
      for (const tool of [...journey.requiredCalls, ...journey.forbiddenCalls]) expect(knownTools.has(tool)).toBe(true)
    }
  })

  it('contains no deprecated overlapping or misleading write tools', () => {
    expect(JSON.stringify(journeys)).not.toMatch(/stage_schedule_update|stage_staff_assignment|stage_announcement|revise_staged_action|publish_approved_plan/)
  })
})
