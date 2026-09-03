import { describe, expect, it } from 'vitest'
import journeys from '../../evals/webmcp-journeys.json'

const knownTools = new Set([
  'get_learning_context',
  'prepare_learning_search',
  'search_learning_resources',
  'inspect_learning_resource',
  'compare_learning_resources',
  'build_learning_path',
  'revise_learning_path',
  'update_learning_progress',
  'replan_remaining_path',
])

describe('WebMCP journey eval dataset', () => {
  it('covers selection, security, constraints, recovery, and lifecycle cases', () => {
    expect(journeys.length).toBeGreaterThanOrEqual(10)
    const categories = new Set(journeys.map((journey) => journey.category))
    for (const category of ['end-to-end', 'tool-selection', 'read-only', 'security', 'constraint-validation', 'failure-recovery', 'state-lifecycle']) expect(categories.has(category)).toBe(true)
  })

  it('references only registered WebMCP tools', () => {
    for (const journey of journeys) {
      expect(journey.prompt.length).toBeGreaterThan(10)
      expect(journey.success.length).toBeGreaterThan(10)
      for (const tool of [...journey.requiredCalls, ...journey.forbiddenCalls]) expect(knownTools.has(tool)).toBe(true)
    }
  })

  it('contains no deprecated or overlapping path tools', () => {
    expect(JSON.stringify(journeys)).not.toMatch(/build_weekly_schedule|save_approved_roadmap|highlight_plan_evidence|record_learning_progress/)
  })
})
