import { describe, expect, it } from 'vitest'
import { initialEvent } from '../data/demoEvent'
import { applyPublishedPacket, buildDispatchReceipts, buildHeroPacket, buildIncidentPacket, eventHealth, incidentContext, participantSignals, validatePacket, validateScheduleWindow } from './eventEngine'

describe('Backstage event engine', () => {
  it('starts with a readable critical event state', () => {
    expect(eventHealth(initialEvent)).toBe(80)
    expect(initialEvent.incidents.find((item) => item.id === 'room-b-capacity')?.status).toBe('open')
  })

  it('builds a bounded three-action hero packet', () => {
    const packet = buildHeroPacket(initialEvent)
    expect(packet.actions).toHaveLength(3)
    expect(packet.evidence).toHaveLength(3)
    expect(packet.alternatives.find((alternative) => alternative.decision === 'selected')?.id).toBe('alt-breakout')
    expect(packet.metrics.constraintChecks).toBe(3)
    expect(packet.status).toBe('staged')
    expect(packet.constraints).toContain('No application without human approval')
    expect(validatePacket(packet, initialEvent)).toEqual([])
  })

  it('rejects a packet that points at an unavailable resource', () => {
    const packet = buildHeroPacket(initialEvent)
    packet.actions[0].target = { ...packet.actions[0].target, room: 'Room B' }
    expect(validatePacket(packet, initialEvent)).toContain('Schedule target is not available.')
  })

  it('rejects packets without proof or a selected alternative', () => {
    const packet = buildHeroPacket(initialEvent)
    packet.evidence = []
    packet.alternatives = packet.alternatives.map((alternative) => ({ ...alternative, decision: 'rejected' as const }))
    expect(validatePacket(packet, initialEvent)).toEqual(expect.arrayContaining(['Packet is missing evidence provenance.', 'Packet is missing a selected alternative.']))
  })

  it('keeps the initial packet staged until a human approves it', () => {
    const packet = buildHeroPacket(initialEvent)
    expect(packet.status).toBe('staged')
    expect(packet.constraints).toContain('No application without human approval')
  })

  it('builds a different response for the auth blocker incident', () => {
    const packet = buildIncidentPacket(initialEvent, 'auth-blockers')
    expect(packet.title).toBe('Restore workshop sign-in access')
    expect(packet.actions.find((action) => action.type === 'schedule')?.target?.room).toBe('Studio C')
    expect(packet.actions.find((action) => action.type === 'staff')?.target?.staffId).toBe('ines')
    expect(validatePacket(packet, initialEvent)).toEqual([])
  })

  it('publishes the selected room and staff from the packet', () => {
    const packet = buildIncidentPacket(initialEvent, 'auth-blockers')
    const next = applyPublishedPacket(initialEvent, packet)
    expect(next.rooms.find((room) => room.name === 'Studio C')?.status).toBe('in-use')
    expect(next.staff.find((person) => person.id === 'ines')?.status).toBe('assigned')
    expect(next.staff.find((person) => person.id === 'ines')?.location).toBe('Studio C')
    expect(next.staff.find((person) => person.id === 'luis')?.status).toBe('available')
    expect(next.incidents.find((incident) => incident.id === 'room-b-capacity')?.status).toBe('open')
    expect(next.incidents.find((incident) => incident.id === 'auth-blockers')?.status).toBe('monitoring')
  })

  it('rejects unknown ids instead of silently falling back', () => {
    expect(incidentContext(initialEvent, 'not-real')).toBeUndefined()
    expect(participantSignals(initialEvent, 'not-real')).toBeUndefined()
    expect(() => buildIncidentPacket(initialEvent, 'not-real')).toThrow('cannot be staged')
  })

  it('validates strict time format, ordering, and the locked end', () => {
    expect(validateScheduleWindow('11:25', '11:40')).toBeUndefined()
    expect(validateScheduleWindow('11.25', '11:40')).toContain('Invalid time format')
    expect(validateScheduleWindow('11:40', '11:25')).toContain('earlier than end')
    expect(validateScheduleWindow('11:40', '12:05')).toContain('locked 12:00')
  })

  it('creates explicit in-app receipts for every applied destination', () => {
    const receipts = buildDispatchReceipts(buildHeroPacket(initialEvent))
    expect(receipts.map((receipt) => receipt.kind)).toEqual(['room-board', 'staff-brief', 'attendee-notice'])
    expect(receipts.every((receipt) => receipt.delivery === 'in-app simulation')).toBe(true)
    expect(receipts[0].summary).toContain('Breakout Room A')
  })
})
