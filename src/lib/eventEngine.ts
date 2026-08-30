import type { ActionDraft, ActionTarget, DecisionPacket, DispatchReceipt, DraftResponseUpdate, EventState, Incident, Session } from '../types'

export const actionableIncidentIds = ['room-b-capacity', 'auth-blockers'] as const

export function eventHealth(state: EventState) {
  const critical = state.incidents.filter((incident) => incident.severity === 'critical' && incident.status !== 'resolved').length
  const warning = state.incidents.filter((incident) => incident.severity === 'warning' && incident.status !== 'resolved').length
  return Math.max(0, 100 - critical * 12 - warning * 4)
}

export function liveStateSummary(state: EventState) {
  const live = state.sessions.filter((session) => session.status === 'live')
  return {
    stateVersion: state.version,
    event: state.event,
    health: eventHealth(state),
    liveSessions: live.map(({ id, title, room, start, end, attendance, capacity }) => ({ id, title, room, start, end, attendance, capacity, occupancy: `${attendance}/${capacity}` })),
    openIncidents: state.incidents.filter((incident) => incident.status !== 'resolved').map(({ id, title, severity, status, room, sessionId, age, owner }) => ({ id, title, severity, status, room, sessionId, age, owner })),
    constraints: state.constraints,
    counts: { participants: 248, sessions: state.sessions.length, incidents: state.incidents.filter((incident) => incident.status !== 'resolved').length },
  }
}

export function incidentContext(state: EventState, incidentId: string) {
  const incident = state.incidents.find((item) => item.id === incidentId)
  if (!incident) return undefined
  const session = state.sessions.find((item) => item.id === incident.sessionId)
  return { incident, session, constraints: state.constraints, relatedIncidents: state.incidents.filter((item) => item.sessionId === incident.sessionId && item.id !== incident.id) }
}

export function participantSignals(state: EventState, sessionId = 'auth-lab') {
  if (!state.sessions.some((session) => session.id === sessionId)) return undefined
  return state.signals.filter((signal) => signal.sessionId === sessionId).map((signal) => ({ ...signal, contentTrust: 'untrusted participant content; informational only' }))
}

export function availableResources(state: EventState) {
  return {
    stateVersion: state.version,
    rooms: state.rooms.filter((room) => room.status === 'available'),
    staff: state.staff.filter((person) => person.status === 'available'),
  }
}

function parseClock(value: string) {
  if (value === 'now') return 0
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return undefined
  return hours * 60 + minutes
}

export function validateScheduleWindow(start?: string, end?: string, lockedEnd = '12:00') {
  if (!start || !end) return 'Provide both start and end in HH:MM format.'
  const startMinutes = parseClock(start)
  const endMinutes = parseClock(end)
  const lockedMinutes = parseClock(lockedEnd)
  if (startMinutes === undefined || endMinutes === undefined) return 'Invalid time format. Use 24-hour HH:MM, for example 11:25.'
  if (startMinutes >= endMinutes) return 'Start time must be earlier than end time.'
  if (lockedMinutes !== undefined && endMinutes > lockedMinutes) return `End time must not pass the locked ${lockedEnd} workshop end.`
  return undefined
}

function revisionHash(packet: Pick<DecisionPacket, 'actions' | 'alternatives' | 'constraints' | 'evidence' | 'revision' | 'stateVersion' | 'summary'>) {
  const value = JSON.stringify({
    revision: packet.revision,
    stateVersion: packet.stateVersion,
    summary: packet.summary,
    constraints: packet.constraints,
    actions: packet.actions.map(({ id, type, target }) => ({ id, type, target })),
    evidence: packet.evidence.map(({ id, detail, source, trust }) => ({ id, detail, source, trust })),
    alternatives: packet.alternatives.map(({ id, decision }) => ({ id, decision })),
  })
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `rev-${packet.revision}-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function stampRevision(packet: DecisionPacket): DecisionPacket {
  return { ...packet, revisionId: revisionHash(packet) }
}

function selectRoom(state: EventState, requiredCapacity: number) {
  const candidates = ['Studio C', 'Atrium Annex']
  return candidates.map((name) => state.rooms.find((room) => room.name === name)).find((room) => room?.status === 'available' && room.access === 'step-free' && room.capacity >= requiredCapacity)
}

function packetForIncident(state: EventState, incidentId: string): DecisionPacket {
  const authOnly = incidentId === 'auth-blockers'
  const requiredCapacity = authOnly ? 17 : 20
  const room = selectRoom(state, requiredCapacity)
  const roomName = room?.name ?? 'Atrium Annex'
  const start = roomName === 'Studio C' ? '11:25' : '11:30'
  const end = roomName === 'Studio C' ? '11:45' : '11:55'
  const staff = state.staff.find((item) => item.id === 'luis' && item.status === 'available') ?? state.staff.find((item) => item.id === 'ines' && item.status === 'available')
  const staffName = staff?.name ?? 'Luis Ortega'
  const staffId = staff?.id ?? 'luis'
  const scheduleTarget: ActionTarget = { room: roomName, start, end }
  const staffTarget: ActionTarget = { staffId }
  const announcementTarget: ActionTarget = {
    audience: authOnly ? '17 attendees who cannot sign in' : '20 attendees needing seats or sign-in help',
    message: `${authOnly ? 'Sign-in help' : 'Overflow seats and sign-in help'} will be available in ${roomName} from ${start}. Follow the step-free route from Room B.`,
  }
  const actions: ActionDraft[] = [
    { id: 'action-room', type: 'schedule', title: authOnly ? 'Open a step-free sign-in help room' : 'Open one step-free recovery room', before: authOnly ? '17 attendees blocked in Room B' : 'Room B · 63 people / 60 seats · 17 sign-in blockers', after: `${roomName} · ${start}–${end} · ${room?.capacity ?? 22} seats`, impact: authOnly ? 'Creates an accessible support path without extending the workshop.' : 'Seats the overflow and moves sign-in support without disrupting all 63 attendees.', status: 'proposed', createdBy: 'agent', incidentId: authOnly ? 'auth-blockers' : 'room-b-capacity', target: scheduleTarget },
    { id: 'action-staff', type: 'staff', title: 'Assign a qualified sign-in specialist', before: 'No support assigned', after: `${staffName} · ${staff?.role ?? 'Developer support'}`, impact: 'Uses the available staff member with authentication expertise before their 11:50 handoff.', status: 'proposed', createdBy: 'agent', incidentId: 'auth-blockers', target: staffTarget },
    { id: 'action-message', type: 'announcement', title: 'Draft an accessible attendee notice', before: 'No targeted message', after: `${announcementTarget.audience} · ${announcementTarget.message}`, impact: 'Names the destination, time, and step-free route for only the affected attendees.', status: 'proposed', createdBy: 'agent', incidentId: 'auth-blockers', target: announcementTarget },
  ]
  const evidence = [
    ...(!authOnly ? [{ id: 'evidence-capacity', label: 'Capacity incident', detail: 'Room B is at 63 / 60 with three attendees standing.', source: 'Incident queue · live state', observedAt: state.event.currentTime, trust: 'trusted' as const }] : []),
    { id: 'evidence-auth', label: 'Attendee sign-in reports', detail: '17 attendees report that they cannot sign in to the workshop exercise.', source: 'Participant pulse · clustered', observedAt: state.event.currentTime, trust: 'untrusted' as const },
    { id: 'evidence-access', label: 'Verified accessibility need', detail: 'One affected attendee requires a step-free route; stairs-only rooms are invalid.', source: 'Accessibility desk · accommodation record', observedAt: state.event.currentTime, trust: 'trusted' as const },
    { id: 'evidence-room', label: `${roomName} availability`, detail: `${roomName} is step-free, seats ${room?.capacity ?? 22}, and is available ${room?.availableFrom ?? '11:30'}${room?.availableUntil ? `–${room.availableUntil}` : ' onward'}.`, source: 'Resource bench · live state', observedAt: state.event.currentTime, trust: 'trusted' as const },
    { id: 'evidence-staff', label: `${staffName} availability`, detail: `${staffName} has ${staff?.specialties.join(', ') ?? 'authentication'} expertise and is available${staff?.availableUntil ? ` until ${staff.availableUntil}` : ' for the full response window'}.`, source: 'Staff bench · live state', observedAt: state.event.currentTime, trust: 'trusted' as const },
    { id: 'evidence-turnover', label: 'Competing production lock', detail: 'Studio C must clear by 11:50 for the keynote rehearsal.', source: 'Production schedule · room lock', observedAt: state.event.currentTime, trust: 'trusted' as const },
  ]
  const selectedAlternative = roomName === 'Studio C' ? 'alt-studio' : 'alt-atrium'
  const alternatives = [
    { id: 'alt-studio', label: 'Use Studio C until 11:45', outcome: 'Closest step-free room; seats all affected attendees with a turnover buffer.', disruption: 'Low · strict 11:45 release', decision: selectedAlternative === 'alt-studio' ? 'selected' as const : 'rejected' as const },
    { id: 'alt-atrium', label: 'Use Atrium Annex', outcome: 'Step-free capacity for 22, but opens later and needs setup.', disruption: 'Medium · longer route', decision: selectedAlternative === 'alt-atrium' ? 'selected' as const : 'rejected' as const },
    { id: 'alt-breakout', label: 'Use Breakout Room A', outcome: 'Fails the 20-person capacity and step-free requirements.', disruption: 'Invalid · capacity + access', decision: 'rejected' as const },
    { id: 'alt-whole-room', label: 'Move the whole workshop', outcome: 'Solves capacity but disrupts all 63 attendees.', disruption: 'High · full-room move', decision: 'rejected' as const },
  ]
  const base: DecisionPacket = {
    id: `response-${incidentId}`,
    title: authOnly ? 'Restore sign-in access before the handoff' : 'Resolve capacity, access, and sign-in together',
    summary: authOnly ? 'Open a qualified, step-free support room while respecting the room and staff handoffs.' : 'Use one step-free room and one qualified support person to resolve both incidents without moving the full workshop.',
    actions,
    constraints: ['Keep workshop end time at 12:00', 'Use a step-free room with at least 20 seats', 'Release Studio C by 11:50', 'Notify only affected attendees', 'No application without human approval'],
    evidence,
    alternatives,
    metrics: { signInReports: 17, seatShortfallResolved: authOnly ? 0 : 3, constraintChecks: 5, coordinatedActions: actions.length },
    status: 'staged',
    revision: 1,
    revisionId: '',
    stateVersion: state.version,
    createdAt: state.event.currentTime,
  }
  return stampRevision(base)
}

export function buildHeroPacket(state: EventState): DecisionPacket {
  return packetForIncident(state, 'room-b-capacity')
}

export function buildIncidentPacket(state: EventState, incidentId: string): DecisionPacket {
  if (!actionableIncidentIds.includes(incidentId as (typeof actionableIncidentIds)[number])) {
    throw new Error(`Incident ${incidentId} cannot be staged in this rehearsal. Use one of: ${actionableIncidentIds.join(', ')}.`)
  }
  return packetForIncident(state, incidentId)
}

export function updateDraftResponse(packet: DecisionPacket, state: EventState, input: DraftResponseUpdate): DecisionPacket {
  if (!input.reason?.trim()) throw new Error('Explain why the draft is changing.')
  if (packet.status === 'applied') throw new Error('An applied response must be reverted before it can be edited.')
  const selectedRoom = input.room ? state.rooms.find((room) => room.name === input.room) : undefined
  const selectedStaff = input.staffId ? state.staff.find((person) => person.id === input.staffId) : undefined
  const actions = packet.actions.map((action) => {
    if (action.type === 'schedule' && (input.room || input.start || input.end)) {
      const room = input.room ?? action.target?.room
      const start = input.start ?? action.target?.start
      const end = input.end ?? action.target?.end
      return { ...action, after: `${room} · ${start}–${end} · ${selectedRoom?.capacity ?? state.rooms.find((item) => item.name === room)?.capacity ?? 0} seats`, status: 'edited' as const, createdBy: 'agent' as const, target: { ...action.target, room, start, end } }
    }
    if (action.type === 'staff' && selectedStaff) {
      return { ...action, after: `${selectedStaff.name} · ${selectedStaff.role}`, impact: `${selectedStaff.name} has sign-in expertise and is available${selectedStaff.availableUntil ? ` until ${selectedStaff.availableUntil}` : ' for the full response window'}.`, status: 'edited' as const, createdBy: 'agent' as const, target: { ...action.target, staffId: selectedStaff.id } }
    }
    if (action.type === 'announcement' && (input.audience || input.message || input.room || input.start)) {
      const audience = input.audience ?? action.target?.audience
      const room = input.room ?? packet.actions.find((item) => item.type === 'schedule')?.target?.room
      const start = input.start ?? packet.actions.find((item) => item.type === 'schedule')?.target?.start
      const message = input.message ?? `Overflow seats and sign-in help will be available in ${room} from ${start}. Follow the step-free route from Room B.`
      return { ...action, after: `${audience} · ${message}`, status: 'edited' as const, createdBy: 'agent' as const, target: { ...action.target, audience, message } }
    }
    return action
  })
  const selectedAlternative = input.room === 'Studio C' ? 'alt-studio' : input.room === 'Atrium Annex' ? 'alt-atrium' : undefined
  const currentRoomName = actions.find((action) => action.type === 'schedule')?.target?.room
  const currentRoom = state.rooms.find((room) => room.name === currentRoomName)
  const currentStaffId = actions.find((action) => action.type === 'staff')?.target?.staffId
  const currentStaff = state.staff.find((person) => person.id === currentStaffId)
  const evidence = packet.evidence.map((item) => {
    if (item.id === 'evidence-room' && currentRoom) return { ...item, label: `${currentRoom.name} availability`, detail: `${currentRoom.name} is ${currentRoom.access}, seats ${currentRoom.capacity}, and is available ${currentRoom.availableFrom}${currentRoom.availableUntil ? `–${currentRoom.availableUntil}` : ' onward'}.`, source: `Resource bench · event state v${state.version}`, observedAt: state.event.currentTime }
    if (item.id === 'evidence-staff' && currentStaff) return { ...item, label: `${currentStaff.name} availability`, detail: `${currentStaff.name} has ${currentStaff.specialties.join(', ')} expertise and is available${currentStaff.availableUntil ? ` until ${currentStaff.availableUntil}` : ' for the full response window'}.`, source: `Staff bench · event state v${state.version}`, observedAt: state.event.currentTime }
    return item
  })
  const next: DecisionPacket = {
    ...packet,
    actions,
    evidence,
    alternatives: selectedAlternative ? packet.alternatives.map((alternative) => ({ ...alternative, decision: alternative.id === selectedAlternative ? 'selected' as const : 'rejected' as const })) : packet.alternatives,
    status: 'staged',
    revision: packet.revision + 1,
    revisionId: '',
    stateVersion: state.version,
    approvedBy: undefined,
    approvedRevisionId: undefined,
  }
  return stampRevision(next)
}

export function approveDraftResponse(packet: DecisionPacket, approvedBy: string): DecisionPacket {
  return { ...packet, status: 'approved', approvedBy, approvedRevisionId: packet.revisionId }
}

export function approvalMatchesRevision(packet: DecisionPacket) {
  return packet.status === 'approved' && packet.approvedRevisionId === packet.revisionId
}

export function validatePacket(packet: DecisionPacket, state: EventState) {
  const errors: string[] = []
  if (packet.stateVersion !== state.version) errors.push(`Draft is stale: it was based on event state v${packet.stateVersion}, but the event is now v${state.version}. Re-inspect resources and update the draft.`)
  const roomAction = packet.actions.find((action) => action.type === 'schedule')
  const roomName = roomAction?.target?.room
  const room = state.rooms.find((item) => item.name === roomName)
  if (!roomName) errors.push('Schedule target is missing.')
  if (!room || room.status !== 'available') errors.push(`${roomName ?? 'Schedule target'} is not available.`)
  if (room && room.access !== 'step-free') errors.push(`${room.name} is not step-free.`)
  const requiredCapacity = packet.metrics.signInReports + packet.metrics.seatShortfallResolved
  if (room && room.capacity < requiredCapacity) errors.push(`${room.name} seats ${room.capacity}, but the response needs capacity for ${requiredCapacity}.`)
  if (roomAction) {
    const scheduleError = validateScheduleWindow(roomAction.target?.start, roomAction.target?.end)
    if (scheduleError) errors.push(scheduleError)
    const start = roomAction.target?.start ? parseClock(roomAction.target.start) : undefined
    const end = roomAction.target?.end ? parseClock(roomAction.target.end) : undefined
    const availableFrom = room?.availableFrom ? parseClock(room.availableFrom) : undefined
    const availableUntil = room?.availableUntil ? parseClock(room.availableUntil) : undefined
    if (start !== undefined && availableFrom !== undefined && start < availableFrom) errors.push(`${room?.name} is not available until ${room?.availableFrom}.`)
    if (end !== undefined && availableUntil !== undefined && end > availableUntil) errors.push(`${room?.name} must be released by ${room?.availableUntil}.`)
  }
  const staffAction = packet.actions.find((action) => action.type === 'staff')
  const staff = state.staff.find((person) => person.id === staffAction?.target?.staffId)
  if (!staff || staff.status !== 'available') errors.push('Staff target is not available.')
  const roomEnd = roomAction?.target?.end ? parseClock(roomAction.target.end) : undefined
  const staffAvailableUntil = staff?.availableUntil ? parseClock(staff.availableUntil) : undefined
  if (staff && roomEnd !== undefined && staffAvailableUntil !== undefined && roomEnd > staffAvailableUntil) errors.push(`${staff.name} is only available until ${staff.availableUntil}.`)
  if (staff && !staff.specialties.some((specialty) => specialty.includes('auth'))) errors.push(`${staff.name} does not have sign-in or authentication expertise.`)
  if (!packet.constraints.includes('No application without human approval')) errors.push('Human approval constraint is missing.')
  if (!packet.evidence.length) errors.push('Draft is missing evidence provenance.')
  if (packet.alternatives.filter((alternative) => alternative.decision === 'selected').length !== 1) errors.push('Draft must have exactly one selected alternative.')
  const announcement = packet.actions.find((action) => action.type === 'announcement')
  if (!announcement?.target?.audience?.trim()) errors.push('Announcement audience is missing.')
  if (!announcement?.target?.message?.trim()) errors.push('Announcement message is missing.')
  if (packet.status === 'approved' && !approvalMatchesRevision(packet)) errors.push('Approval does not match the current draft revision.')
  return errors
}

export function buildDispatchReceipts(packet: DecisionPacket): DispatchReceipt[] {
  const room = packet.actions.find((action) => action.type === 'schedule')
  const staff = packet.actions.find((action) => action.type === 'staff')
  const announcement = packet.actions.find((action) => action.type === 'announcement')
  if (!room || !staff || !announcement) return []
  return [
    { id: `${packet.revisionId}:room`, kind: 'room-board', audience: 'operator', destination: 'Event room board', summary: `${room.target?.room} reserved ${room.target?.start}–${room.target?.end}.`, status: 'applied-to-demo', delivery: 'in-app simulation', responseRevision: packet.revisionId },
    { id: `${packet.revisionId}:staff`, kind: 'staff-brief', audience: 'staff', destination: 'Staff briefing view', summary: `${staff.after.split(' · ')[0]} assigned to ${room.target?.room}.`, status: 'applied-to-demo', delivery: 'in-app simulation', responseRevision: packet.revisionId },
    { id: `${packet.revisionId}:attendees`, kind: 'attendee-notice', audience: 'affected-attendees', destination: 'Attendee notice preview', summary: announcement.target?.message ?? announcement.after, status: 'applied-to-demo', delivery: 'in-app simulation', responseRevision: packet.revisionId },
  ]
}

export function applyApprovedResponse(state: EventState, packet: DecisionPacket): EventState {
  const addressedIncidentIds = new Set(packet.actions.map((action) => action.incidentId))
  const incidents = state.incidents.map((incident) => addressedIncidentIds.has(incident.id) ? { ...incident, status: 'monitoring' as const, owner: 'Approved response' } : incident)
  const roomName = packet.actions.find((action) => action.type === 'schedule')?.target?.room
  const staffId = packet.actions.find((action) => action.type === 'staff')?.target?.staffId
  const rooms = roomName ? state.rooms.map((room) => room.name === roomName ? { ...room, status: 'in-use' as const, note: 'Approved recovery response active' } : room) : state.rooms
  const staff = staffId ? state.staff.map((person) => person.id === staffId ? { ...person, status: 'assigned' as const, location: roomName ?? person.location } : person) : state.staff
  return { ...state, version: state.version + 1, incidents, rooms, staff }
}

export function simulateStudioConflict(state: EventState): EventState {
  return {
    ...state,
    version: state.version + 1,
    rooms: state.rooms.map((room) => room.name === 'Studio C' ? { ...room, status: 'held' as const, note: 'Keynote rehearsal claimed the room early' } : room),
  }
}

export function getSession(state: EventState, id: string): Session | undefined {
  return state.sessions.find((session) => session.id === id)
}

export function getIncident(state: EventState, id: string): Incident | undefined {
  return state.incidents.find((incident) => incident.id === id)
}
