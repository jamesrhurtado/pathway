import { afterEach, describe, expect, it } from 'vitest'
import { registerBackstageTools, type WebMCPBridgeActions } from './webmcp'
import { approveDraftResponse, buildHeroPacket } from './eventEngine'
import { initialEvent } from '../data/demoEvent'

const originalDocument = globalThis.document

afterEach(() => {
  Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true })
})

function bridge(overrides: Partial<WebMCPBridgeActions> = {}): WebMCPBridgeActions {
  return {
    state: initialEvent,
    approved: false,
    canUndo: false,
    stagePacket: () => ({ ok: true }),
    updateDraft: () => ({ ok: true }),
    reviewPlan: () => ({ ok: true }),
    applyResponse: () => ({ ok: true }),
    revertResponse: () => ({ ok: true }),
    ...overrides,
  }
}

function installModelContext() {
  const registered: ModelContextTool[] = []
  let signal: AbortSignal | undefined
  const modelContext: ModelContext = {
    registerTool: (tool, options) => { registered.push(tool); signal = options?.signal },
  }
  Object.defineProperty(globalThis, 'document', { value: { modelContext }, configurable: true })
  return { registered, get signal() { return signal } }
}

describe('Backstage WebMCP lifecycle', () => {
  it('exposes four reads and one staging tool before a response exists', async () => {
    const context = installModelContext()
    let stagedIncident: string | undefined
    const result = registerBackstageTools(bridge({ stagePacket: (input) => { stagedIncident = input?.incidentId; return { ok: true } } }))
    expect(result.names).toHaveLength(5)
    expect(result.names).toContain('stage_decision_packet')
    expect(result.names).not.toContain('update_draft_response')
    expect(result.names).not.toContain('apply_approved_response')
    await context.registered.find((tool) => tool.name === 'stage_decision_packet')?.execute({ incidentId: 'auth-blockers' })
    expect(stagedIncident).toBe('auth-blockers')
  })

  it('records successful and rejected outcomes for the flight recorder', async () => {
    const context = installModelContext()
    const calls: Array<{ name: string; status: string }> = []
    registerBackstageTools(bridge({ recordTool: ({ name, status }) => calls.push({ name, status }) }))
    await context.registered.find((tool) => tool.name === 'get_live_event_state')?.execute({})
    await context.registered.find((tool) => tool.name === 'inspect_incident')?.execute({ incidentId: 'made-up' })
    expect(calls).toEqual([
      { name: 'get_live_event_state', status: 'success' },
      { name: 'inspect_incident', status: 'error' },
    ])
  })

  it('returns actionable recovery guidance for unknown ids', async () => {
    const context = installModelContext()
    registerBackstageTools(bridge())
    const result = await context.registered.find((tool) => tool.name === 'inspect_incident')?.execute({ incidentId: 'made-up' }) as { ok: boolean; error: string; recovery: string }
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unknown incident id')
    expect(result.recovery).toContain('room-b-capacity')
  })

  it('consolidates all draft edits into one narrow atomic schema', () => {
    const context = installModelContext()
    registerBackstageTools(bridge({ stagedPlan: buildHeroPacket(initialEvent) }))
    const update = context.registered.find((tool) => tool.name === 'update_draft_response')
    expect(update?.inputSchema.required).toEqual(['reason'])
    expect(Object.keys(update?.inputSchema.properties ?? {})).toEqual(['room', 'start', 'end', 'staffId', 'audience', 'message', 'reason'])
    expect((update?.inputSchema.properties as { room: { enum: string[] } }).room.enum).toEqual(expect.arrayContaining(['Studio C', 'Atrium Annex', 'Breakout Room A']))
  })

  it('exposes review and consolidated editing only while staged', () => {
    const context = installModelContext()
    const result = registerBackstageTools(bridge({ stagedPlan: buildHeroPacket(initialEvent) }))
    expect(result.names).toEqual(expect.arrayContaining(['review_staged_plan', 'update_draft_response']))
    expect(result.names).not.toContain('stage_decision_packet')
    expect(result.names).not.toContain('apply_approved_response')
    expect(result.names).toHaveLength(6)
  })

  it('exposes apply only for the exact approved revision and aborts cleanly', () => {
    const context = installModelContext()
    const approvedPlan = approveDraftResponse(buildHeroPacket(initialEvent), 'Organizer')
    const result = registerBackstageTools(bridge({ stagedPlan: approvedPlan, approved: true }))
    expect(result.names).toEqual(expect.arrayContaining(['review_staged_plan', 'apply_approved_response']))
    expect(result.names).not.toContain('update_draft_response')
    expect(result.names).toHaveLength(6)
    result.cleanup()
    expect(context.signal?.aborted).toBe(true)
  })

  it('replaces apply with revert after the response is applied', () => {
    installModelContext()
    const applied = { ...approveDraftResponse(buildHeroPacket(initialEvent), 'Organizer'), status: 'applied' as const }
    const result = registerBackstageTools(bridge({ stagedPlan: applied, approved: false, canUndo: true }))
    expect(result.names).toContain('revert_applied_response')
    expect(result.names).not.toContain('apply_approved_response')
    expect(result.names).not.toContain('review_staged_plan')
    expect(result.names).toHaveLength(5)
  })
})
