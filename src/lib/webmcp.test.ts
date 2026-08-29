import { afterEach, describe, expect, it } from 'vitest'
import { registerBackstageTools, type WebMCPBridgeActions } from './webmcp'
import { buildHeroPacket } from './eventEngine'
import { initialEvent } from '../data/demoEvent'

const originalDocument = globalThis.document

afterEach(() => {
  Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true })
})

function bridge(overrides: Partial<WebMCPBridgeActions> = {}): WebMCPBridgeActions {
  return {
    state: initialEvent,
    approved: false,
    stagePacket: () => ({ ok: true }),
    stageSchedule: () => ({ ok: true }),
    stageStaff: () => ({ ok: true }),
    stageAnnouncement: () => ({ ok: true }),
    reviewPlan: () => ({ ok: true }),
    revisePlan: () => ({ ok: true }),
    publishPlan: () => ({ ok: true }),
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
  it('exposes read tools and initial staging before a packet exists', async () => {
    const context = installModelContext()
    let staged = false
    let stagedIncident: string | undefined
    const result = registerBackstageTools(bridge({ stagePacket: (input) => { staged = true; stagedIncident = input?.incidentId; return { ok: true } } }))
    expect(result.names).toContain('stage_decision_packet')
    expect(result.names).not.toContain('stage_schedule_update')
    expect(result.names).not.toContain('publish_approved_plan')
    expect(context.registered).toHaveLength(5)
    await context.registered.find((tool) => tool.name === 'stage_decision_packet')?.execute({ incidentId: 'auth-blockers' })
    expect(staged).toBe(true)
    expect(stagedIncident).toBe('auth-blockers')
  })

  it('records tool outcomes for the flight recorder', async () => {
    const context = installModelContext()
    const calls: Array<{ name: string; status: string }> = []
    registerBackstageTools(bridge({ recordTool: ({ name, status }) => calls.push({ name, status }) }))
    await context.registered.find((tool) => tool.name === 'get_live_event_state')?.execute({})
    expect(calls).toEqual([{ name: 'get_live_event_state', status: 'success' }])
  })

  it('returns actionable recovery guidance for unknown ids', async () => {
    const context = installModelContext()
    registerBackstageTools(bridge())
    const incidentResult = await context.registered.find((tool) => tool.name === 'inspect_incident')?.execute({ incidentId: 'made-up' }) as { ok: boolean; error: string; recovery: string }
    const signalResult = await context.registered.find((tool) => tool.name === 'inspect_participant_signals')?.execute({ sessionId: 'made-up' }) as { ok: boolean; recovery: string }
    expect(incidentResult.ok).toBe(false)
    expect(incidentResult.error).toContain('Unknown incident id')
    expect(incidentResult.recovery).toContain('room-b-capacity')
    expect(signalResult.ok).toBe(false)
    expect(signalResult.recovery).toContain('auth-lab')
  })

  it('publishes narrow enums and explicit time requirements in write schemas', () => {
    const context = installModelContext()
    registerBackstageTools(bridge({ stagedPlan: buildHeroPacket(initialEvent) }))
    const schedule = context.registered.find((tool) => tool.name === 'stage_schedule_update')
    const staff = context.registered.find((tool) => tool.name === 'stage_staff_assignment')
    expect(schedule?.inputSchema.required).toEqual(['room', 'start', 'end'])
    expect((schedule?.inputSchema.properties as { room: { enum: string[] } }).room.enum).toContain('Breakout Room A')
    expect((staff?.inputSchema.properties as { staffId: { enum: string[] } }).staffId.enum).toContain('ines')
  })

  it('exposes packet editing only while staged', () => {
    const context = installModelContext()
    const stagedPlan = buildHeroPacket(initialEvent)
    const result = registerBackstageTools(bridge({ stagedPlan }))
    expect(result.names).toContain('review_staged_plan')
    expect(result.names).toContain('stage_schedule_update')
    expect(result.names).toContain('revise_staged_action')
    expect(result.names).not.toContain('stage_decision_packet')
    expect(result.names).not.toContain('publish_approved_plan')
    expect(context.registered).toHaveLength(9)
  })

  it('exposes only review and publish after human approval and aborts on cleanup', () => {
    const context = installModelContext()
    const approvedPlan = { ...buildHeroPacket(initialEvent), status: 'approved' as const, approvedBy: 'You' }
    const result = registerBackstageTools(bridge({ stagedPlan: approvedPlan, approved: true }))
    expect(result.names).toEqual(expect.arrayContaining(['review_staged_plan', 'publish_approved_plan']))
    expect(result.names).not.toContain('stage_staff_assignment')
    expect(result.names).toHaveLength(6)
    result.cleanup()
    expect(context.signal?.aborted).toBe(true)
  })
})
