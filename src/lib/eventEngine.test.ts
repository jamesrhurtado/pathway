import { describe, expect, it } from 'vitest'
import { initialEvent } from '../data/demoEvent'
import { applyApprovedResponse, approvalMatchesRevision, approveDraftResponse, buildDispatchReceipts, buildHeroPacket, buildIncidentPacket, eventHealth, incidentContext, participantSignals, simulateStudioConflict, updateDraftResponse, validatePacket, validateScheduleWindow } from './eventEngine'

describe('Backstage event engine', () => {
  it('starts with a versioned critical event and trusted constraints', () => {
    expect(eventHealth(initialEvent)).toBe(80)
    expect(initialEvent.version).toBe(1)
    expect(initialEvent.constraints.map((item) => item.id)).toEqual(['constraint-end', 'constraint-access', 'constraint-turnover'])
  })

  it('builds a constraint-aware three-action hero response', () => {
    const packet = buildHeroPacket(initialEvent)
    expect(packet.actions).toHaveLength(3)
    expect(packet.evidence).toHaveLength(6)
    expect(packet.evidence.find((item) => item.id === 'evidence-auth')?.trust).toBe('untrusted')
    expect(packet.alternatives.find((alternative) => alternative.decision === 'selected')?.id).toBe('alt-studio')
    expect(packet.metrics.constraintChecks).toBe(5)
    expect(packet.revisionId).toMatch(/^rev-1-/)
    expect(packet.stateVersion).toBe(initialEvent.version)
    expect(validatePacket(packet, initialEvent)).toEqual([])
  })

  it('rejects inaccessible, undersized, and unavailable rooms', () => {
    const packet = buildHeroPacket(initialEvent)
    const inaccessible = updateDraftResponse(packet, initialEvent, { room: 'Breakout Room A', reason: 'Test the invalid fallback explicitly.' })
    expect(validatePacket(inaccessible, initialEvent)).toEqual(expect.arrayContaining([
      'Breakout Room A is not step-free.',
      'Breakout Room A seats 12, but the response needs capacity for 20.',
    ]))
    const unavailable = updateDraftResponse(packet, initialEvent, { room: 'Room B', reason: 'Test an occupied room explicitly.' })
    expect(validatePacket(unavailable, initialEvent)).toContain('Room B is not available.')
  })

  it('detects stale state and supports a coordinated fallback re-plan', () => {
    const packet = buildHeroPacket(initialEvent)
    const changedState = simulateStudioConflict(initialEvent)
    expect(validatePacket(packet, changedState).join(' ')).toContain('Draft is stale')
    const replanned = updateDraftResponse(packet, changedState, {
      room: 'Atrium Annex',
      start: '11:30',
      end: '11:55',
      staffId: 'ines',
      reason: 'Studio C changed live, so use the remaining accessible room and available specialist.',
    })
    expect(replanned.stateVersion).toBe(changedState.version)
    expect(replanned.revisionId).not.toBe(packet.revisionId)
    expect(replanned.actions.find((action) => action.type === 'staff')?.target?.staffId).toBe('ines')
    expect(replanned.evidence.find((item) => item.id === 'evidence-room')?.label).toBe('Atrium Annex availability')
    expect(replanned.evidence.find((item) => item.id === 'evidence-staff')?.label).toBe('Inés Paredes availability')
    expect(validatePacket(replanned, changedState)).toEqual([])
  })

  it('rejects a fallback that outlasts its assigned staff member', () => {
    const changedState = simulateStudioConflict(initialEvent)
    const packet = updateDraftResponse(buildHeroPacket(initialEvent), changedState, {
      room: 'Atrium Annex', start: '11:30', end: '11:55', reason: 'Keep Luis despite the later fallback window.',
    })
    expect(validatePacket(packet, changedState)).toContain('Luis Ortega is only available until 11:50.')
  })

  it('binds approval to one immutable response revision', () => {
    const packet = buildHeroPacket(initialEvent)
    const approved = approveDraftResponse(packet, 'Organizer')
    expect(approvalMatchesRevision(approved)).toBe(true)
    const edited = updateDraftResponse(approved, initialEvent, { staffId: 'ines', reason: 'Organizer requested the alternate qualified person.' })
    expect(edited.status).toBe('staged')
    expect(edited.approvedRevisionId).toBeUndefined()
    expect(approvalMatchesRevision(edited)).toBe(false)
  })

  it('builds a valid response for the sign-in incident alone', () => {
    const packet = buildIncidentPacket(initialEvent, 'auth-blockers')
    expect(packet.title).toBe('Restore sign-in access before the handoff')
    expect(packet.actions.find((action) => action.type === 'schedule')?.target?.room).toBe('Studio C')
    expect(packet.actions.find((action) => action.type === 'staff')?.target?.staffId).toBe('luis')
    expect(validatePacket(packet, initialEvent)).toEqual([])
  })

  it('applies the selected room and staff atomically and increments state', () => {
    const packet = approveDraftResponse(buildHeroPacket(initialEvent), 'Organizer')
    const next = applyApprovedResponse(initialEvent, packet)
    expect(next.version).toBe(2)
    expect(next.rooms.find((room) => room.name === 'Studio C')?.status).toBe('in-use')
    expect(next.staff.find((person) => person.id === 'luis')?.status).toBe('assigned')
    expect(next.incidents.find((incident) => incident.id === 'room-b-capacity')?.status).toBe('monitoring')
    expect(next.incidents.find((incident) => incident.id === 'auth-blockers')?.status).toBe('monitoring')
  })

  it('rejects unknown ids instead of silently falling back', () => {
    expect(incidentContext(initialEvent, 'not-real')).toBeUndefined()
    expect(participantSignals(initialEvent, 'not-real')).toBeUndefined()
    expect(() => buildIncidentPacket(initialEvent, 'not-real')).toThrow('cannot be staged')
  })

  it('validates strict time format, ordering, and locked end', () => {
    expect(validateScheduleWindow('11:25', '11:40')).toBeUndefined()
    expect(validateScheduleWindow('11.25', '11:40')).toContain('Invalid time format')
    expect(validateScheduleWindow('11:40', '11:25')).toContain('earlier than end')
    expect(validateScheduleWindow('11:40', '12:05')).toContain('locked 12:00')
  })

  it('creates stable revision-bound receipts for each in-app destination', () => {
    const packet = buildHeroPacket(initialEvent)
    const receipts = buildDispatchReceipts(packet)
    expect(receipts.map((receipt) => receipt.kind)).toEqual(['room-board', 'staff-brief', 'attendee-notice'])
    expect(receipts.every((receipt) => receipt.delivery === 'in-app simulation')).toBe(true)
    expect(receipts.every((receipt) => receipt.responseRevision === packet.revisionId)).toBe(true)
    expect(receipts[0].summary).toContain('Studio C')
  })
})
