import { describe, expect, it } from 'vitest'
import journeys from '../../evals/webmcp-journeys.json'

const knownTools = new Set([
  'get_live_event_state',
  'inspect_incident',
  'inspect_participant_signals',
  'find_available_resources',
  'stage_decision_packet',
  'stage_schedule_update',
  'stage_staff_assignment',
  'stage_announcement',
  'review_staged_plan',
  'revise_staged_action',
  'publish_approved_plan',
])

describe('WebMCP journey eval dataset', () => {
  it('covers direct, open-ended, read-only, security, recovery, and lifecycle cases', () => {
    expect(new Set(journeys.map((journey) => journey.category))).toEqual(new Set(['end-to-end', 'tool-selection', 'read-only', 'security', 'failure-recovery', 'state-lifecycle']))
  })

  it('references only registered WebMCP tools', () => {
    for (const journey of journeys) {
      expect(journey.prompt.length).toBeGreaterThan(10)
      expect(journey.success.length).toBeGreaterThan(10)
      for (const tool of [...journey.requiredCalls, ...journey.forbiddenCalls]) expect(knownTools.has(tool)).toBe(true)
    }
  })
})
