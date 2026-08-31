import { describe, expect, it } from 'vitest'
import { initialEvent } from '../data/demoEvent'
import { applyApprovedResponse, approvalMatchesRevision, approveDraftResponse, buildAgentPacket, buildDispatchReceipts, buildHeroPacket, buildIncidentPacket, eventHealth, incidentContext, participantSignals, restorePreApplicationState, simulateStudioConflict, updateDraftResponse, validatePacket, validateScheduleWindow } from './eventEngine'

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
    expect(replanned.rationale).toContain('remaining accessible room')
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

  it('selects a different valid room and impact when the seeded state changes', () => {
    const alternate = {
      ...initialEvent,
      version: 7,
      affectedParticipants: { overflow: 0, signInBlocked: 4, overlap: 0 },
      rooms: initialEvent.rooms.map((room) => room.name === 'Studio C' ? { ...room, status: 'held' as const } : room),
    }
    const packet = buildIncidentPacket(alternate, 'auth-blockers')
    expect(packet.actions.find((action) => action.type === 'schedule')?.target?.room).toBe('Atrium Annex')
    expect(packet.metrics.signInReports).toBe(4)
    expect(packet.evidence.some((item) => item.id === 'evidence-capacity')).toBe(false)
    expect(validatePacket(packet, alternate)).toEqual([])
  })

  it('builds a packet from the agent proposal and rejects stale proposals', () => {
    const packet = buildAgentPacket(initialEvent, {
      incidentIds: ['room-b-capacity', 'auth-blockers'],
      expectedStateVersion: 1,
      room: 'Studio C',
      start: '11:25',
      end: '11:45',
      staffId: 'luis',
      audience: '20 affected attendees',
      message: 'Recovery support is available in Studio C from 11:25.',
      reason: 'Use the closest step-free room and qualified specialist without moving the full workshop.',
      evidenceIds: ['evidence-capacity', 'evidence-auth', 'evidence-access', 'evidence-room', 'evidence-staff'],
    })
    expect(packet.rationale).toContain('closest step-free room')
    expect(packet.actions.find((action) => action.type === 'schedule')?.target?.room).toBe('Studio C')
    expect(validatePacket(packet, initialEvent)).toEqual([])
    expect(() => buildAgentPacket(simulateStudioConflict(initialEvent), {
      incidentIds: ['room-b-capacity'], expectedStateVersion: 1, room: 'Atrium Annex', start: '11:30', end: '11:55', staffId: 'ines', audience: '3 attendees', message: 'Use Atrium Annex.', reason: 'Replan after the room conflict.', evidenceIds: ['evidence-capacity'],
    })).toThrow('event is now v2')
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

  it('restores the exact payload on rollback while keeping versions monotonic', () => {
    const packet = approveDraftResponse(buildHeroPacket(initialEvent), 'Organizer')
    const applied = applyApprovedResponse(initialEvent, packet)
    const restored = restorePreApplicationState(applied, initialEvent)
    expect(restored.version).toBe(3)
    expect(restored.rooms).toEqual(initialEvent.rooms)
    expect(restored.staff).toEqual(initialEvent.staff)
    expect(restored.incidents).toEqual(initialEvent.incidents)
  })

  it('keeps the full stale-conflict apply/rollback sequence monotonic', () => {
    const draft = buildHeroPacket(initialEvent)
    const conflictedState = simulateStudioConflict(initialEvent)
    const replanned = updateDraftResponse(draft, conflictedState, { room: 'Atrium Annex', start: '11:30', end: '11:55', staffId: 'ines', reason: 'Studio C was claimed; use the remaining accessible room and specialist.' })
    const appliedState = applyApprovedResponse(conflictedState, approveDraftResponse(replanned, 'Organizer'))
    const restored = restorePreApplicationState(appliedState, conflictedState)
    expect([draft.stateVersion, conflictedState.version, appliedState.version, restored.version]).toEqual([1, 2, 3, 4])
    expect(restored.rooms).toEqual(conflictedState.rooms)
    expect(restored.staff).toEqual(conflictedState.staff)
    expect(restored.incidents).toEqual(conflictedState.incidents)
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
