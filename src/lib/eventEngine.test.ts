import { describe, expect, it } from 'vitest'
import { initialEvent } from '../data/demoEvent'
import { applyPublishedPacket, buildHeroPacket, buildIncidentPacket, eventHealth, validatePacket } from './eventEngine'

describe('Backstage event engine', () => {
  it('starts with a readable critical event state', () => {
    expect(eventHealth(initialEvent)).toBe(80)
    expect(initialEvent.incidents.find((item) => item.id === 'room-b-capacity')?.status).toBe('open')
  })

  it('builds a bounded three-action hero packet', () => {
    const packet = buildHeroPacket(initialEvent)
    expect(packet.actions).toHaveLength(3)
    expect(packet.status).toBe('staged')
    expect(packet.constraints).toContain('No publication without human approval')
    expect(validatePacket(packet, initialEvent)).toEqual([])
  })

  it('rejects a packet that points at an unavailable resource', () => {
    const packet = buildHeroPacket(initialEvent)
    packet.actions[0].target = { ...packet.actions[0].target, room: 'Room B' }
    expect(validatePacket(packet, initialEvent)).toContain('Schedule target is not available.')
  })

  it('keeps the initial packet staged until a human approves it', () => {
    const packet = buildHeroPacket(initialEvent)
    expect(packet.status).toBe('staged')
    expect(packet.constraints).toContain('No publication without human approval')
  })

  it('builds a different response for the auth blocker incident', () => {
    const packet = buildIncidentPacket(initialEvent, 'auth-blockers')
    expect(packet.title).toBe('Unblock the auth clinic')
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
  })
})
