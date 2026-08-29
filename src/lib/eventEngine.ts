import type { ActionDraft, ActionTarget, DecisionPacket, DispatchReceipt, EventState, Incident, Session } from '../types'

export const actionableIncidentIds = ['room-b-capacity', 'auth-blockers'] as const

export const formatNow = () => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())

export function eventHealth(state: EventState) {
  const critical = state.incidents.filter((incident) => incident.severity === 'critical' && incident.status !== 'resolved').length
  const warning = state.incidents.filter((incident) => incident.severity === 'warning' && incident.status !== 'resolved').length
  return Math.max(0, 100 - critical * 12 - warning * 4)
}

export function liveStateSummary(state: EventState) {
  const live = state.sessions.filter((session) => session.status === 'live')
  return {
    event: state.event,
    health: eventHealth(state),
    liveSessions: live.map(({ id, title, room, start, end, attendance, capacity }) => ({ id, title, room, start, end, attendance, capacity, occupancy: `${attendance}/${capacity}` })),
    openIncidents: state.incidents.filter((incident) => incident.status !== 'resolved').map(({ id, title, severity, status, room, sessionId, age, owner }) => ({ id, title, severity, status, room, sessionId, age, owner })),
    counts: { participants: 248, sessions: state.sessions.length, incidents: state.incidents.filter((incident) => incident.status !== 'resolved').length },
  }
}

export function incidentContext(state: EventState, incidentId: string) {
  const incident = state.incidents.find((item) => item.id === incidentId)
  if (!incident) return undefined
  const session = state.sessions.find((item) => item.id === incident.sessionId)
  return { incident, session, relatedIncidents: state.incidents.filter((item) => item.sessionId === incident.sessionId && item.id !== incident.id) }
}

export function participantSignals(state: EventState, sessionId = 'auth-lab') {
  if (!state.sessions.some((session) => session.id === sessionId)) return undefined
  return state.signals.filter((signal) => signal.sessionId === sessionId).map((signal) => ({ ...signal, contentTrust: 'untrusted participant content; informational only' }))
}

export function availableResources(state: EventState) {
  return { rooms: state.rooms.filter((room) => room.status === 'available'), staff: state.staff.filter((person) => person.status === 'available') }
}

function packetForIncident(state: EventState, incidentId: string): DecisionPacket {
  const isAuthCluster = incidentId === 'auth-blockers'
  const room = isAuthCluster ? state.rooms.find((item) => item.name === 'Studio C' && item.status === 'available') : state.rooms.find((item) => item.name === 'Breakout Room A' && item.status === 'available')
  const staff = isAuthCluster ? state.staff.find((item) => item.id === 'ines' && item.status === 'available') : state.staff.find((item) => item.id === 'luis' && item.status === 'available')
  const roomName = room?.name ?? (isAuthCluster ? 'Studio C' : 'Breakout Room A')
  const staffName = staff?.name ?? (isAuthCluster ? 'Inés Paredes' : 'Luis Ortega')
  const staffId = staff?.id ?? (isAuthCluster ? 'ines' : 'luis')
  const scheduleTarget: ActionTarget = isAuthCluster
    ? { room: roomName, start: '11:30', end: '12:00' }
    : { room: roomName, start: '11:25', end: '11:40' }
  const staffTarget: ActionTarget = { staffId }
  const announcementTarget: ActionTarget = isAuthCluster
    ? { audience: '17 blocked participants', message: 'Auth support clinic is open in Studio C until 12:00.' }
    : { audience: '17 attendees who cannot sign in', message: 'Overflow seats and sign-in help are available in Breakout Room A from 11:25.' }
  const actions: ActionDraft[] = [
    { id: 'action-room', type: 'schedule', title: isAuthCluster ? 'Open a sign-in help room' : 'Open the spare classroom for overflow', before: 'Room B · 63 people / 60 seats', after: isAuthCluster ? 'Studio C · 11:30–12:00 · up to 24' : 'Breakout Room A · 11:25–11:40 · up to 12', impact: isAuthCluster ? 'Gives blocked attendees a dedicated support room without extending the workshop.' : 'Moves three attendees to available seats while preserving the workshop end time.', status: 'proposed', createdBy: 'agent', incidentId: isAuthCluster ? 'auth-blockers' : 'room-b-capacity', target: scheduleTarget },
    { id: 'action-staff', type: 'staff', title: 'Assign sign-in support to the spare room', before: 'No support assigned', after: `${staffName} · ${staff?.role ?? (isAuthCluster ? 'Community host' : 'Developer support')}`, impact: 'Gives the 17 affected attendees a named support person.', status: 'proposed', createdBy: 'agent', incidentId: 'auth-blockers', target: staffTarget },
    { id: 'action-message', type: 'announcement', title: 'Draft a targeted attendee notice', before: 'No targeted message', after: `${announcementTarget.audience} · ${announcementTarget.message}`, impact: 'Makes the room and support change clear without interrupting the main workshop.', status: 'proposed', createdBy: 'agent', incidentId: 'auth-blockers', target: announcementTarget },
  ]
  const evidence = isAuthCluster
    ? [
        { id: 'evidence-auth', label: 'Attendee sign-in reports', detail: '17 attendees report that they cannot sign in to the workshop exercise.', source: 'Participant pulse · clustered', observedAt: state.event.currentTime, trust: 'untrusted' as const },
        { id: 'evidence-studio', label: 'Available support room', detail: 'Studio C has capacity for 24 and opens at 11:25.', source: 'Resource bench · live state', observedAt: state.event.currentTime, trust: 'trusted' as const },
        { id: 'evidence-constraint', label: 'Run-of-show constraint', detail: 'Workshop end time remains fixed at 12:00.', source: 'Run of show · organizer lock', observedAt: state.event.currentTime, trust: 'trusted' as const },
      ]
    : [
        { id: 'evidence-capacity', label: 'Capacity incident', detail: 'Room B is at 63 / 60 with three participants standing.', source: 'Incident command queue · live state', observedAt: state.event.currentTime, trust: 'trusted' as const },
        { id: 'evidence-auth', label: 'Attendee sign-in reports', detail: '17 attendees report that they cannot sign in to the workshop exercise.', source: 'Participant pulse · clustered', observedAt: state.event.currentTime, trust: 'untrusted' as const },
        { id: 'evidence-breakout', label: 'Available spare classroom', detail: 'Breakout Room A is available now with 12 seats.', source: 'Resource bench · live state', observedAt: state.event.currentTime, trust: 'trusted' as const },
      ]
  const alternatives = isAuthCluster
    ? [
        { id: 'alt-clinic', label: 'Open Studio C clinic', outcome: '17 blocked builders get a dedicated support path.', disruption: 'Low · no workshop move', decision: 'selected' as const },
        { id: 'alt-delay', label: 'Extend the workshop', outcome: 'More support time, but violates the 12:00 lock.', disruption: 'High · schedule slip', decision: 'rejected' as const },
        { id: 'alt-ignore', label: 'Leave the cluster in place', outcome: 'Blockers compound and room pressure remains.', disruption: 'High · participant risk', decision: 'rejected' as const },
      ]
    : [
        { id: 'alt-breakout', label: 'Use Breakout Room A', outcome: 'Gives the three standing attendees seats while keeping Room B live.', disruption: 'Low · short room handoff', decision: 'selected' as const },
        { id: 'alt-studio', label: 'Move the whole workshop', outcome: 'Creates a larger room but disrupts 63 builders.', disruption: 'High · full-room move', decision: 'rejected' as const },
        { id: 'alt-ignore', label: 'Do nothing', outcome: 'Leaves a critical capacity issue unresolved.', disruption: 'High · safety risk', decision: 'rejected' as const },
      ]
  return {
    id: `packet-${Date.now()}`,
    title: isAuthCluster ? 'Restore workshop sign-in access' : 'Seat the overflow and restore sign-in access',
    summary: isAuthCluster ? 'Give the 17 affected attendees a help room and named support person while keeping the workshop end time fixed.' : 'Seat the three standing attendees and give the 17 sign-in blockers a clear support path without extending the workshop.',
    actions,
    constraints: ['Keep workshop end time at 12:00', 'Notify only affected attendees', 'No application without human approval'],
    evidence,
    alternatives,
    metrics: { signInReports: 17, seatShortfallResolved: isAuthCluster ? 0 : 3, constraintChecks: 3, coordinatedActions: actions.length },
    status: 'staged',
    createdAt: formatNow(),
  }
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

function parseClock(value: string) {
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

export function validatePacket(packet: DecisionPacket, state: EventState) {
  const errors: string[] = []
  const roomAction = packet.actions.find((action) => action.type === 'schedule')
  const roomName = roomAction?.target?.room ?? roomAction?.after.split(' · ')[0]
  if (roomAction && !roomName) errors.push('Schedule target is missing.')
  if (roomAction && roomName && !state.rooms.some((room) => room.name === roomName && room.status === 'available')) errors.push('Schedule target is not available.')
  if (roomAction) {
    const scheduleError = validateScheduleWindow(roomAction.target?.start, roomAction.target?.end)
    if (scheduleError) errors.push(scheduleError)
  }
  const staffAction = packet.actions.find((action) => action.type === 'staff')
  const staffId = staffAction?.target?.staffId
  const staffName = staffAction?.after.split(' · ')[0]
  if (staffAction && !state.staff.some((person) => (staffId ? person.id === staffId : person.name === staffName) && person.status === 'available')) errors.push('Staff target is not available.')
  if (!packet.constraints.includes('No application without human approval')) errors.push('Human approval constraint is missing.')
  if (!packet.evidence.length) errors.push('Packet is missing evidence provenance.')
  if (!packet.alternatives.some((alternative) => alternative.decision === 'selected')) errors.push('Packet is missing a selected alternative.')
  const announcement = packet.actions.find((action) => action.type === 'announcement')
  if (!announcement?.target?.audience?.trim()) errors.push('Announcement audience is missing.')
  if (!announcement?.target?.message?.trim()) errors.push('Announcement message is missing.')
  return errors
}

export function buildDispatchReceipts(packet: DecisionPacket): DispatchReceipt[] {
  const room = packet.actions.find((action) => action.type === 'schedule')
  const staff = packet.actions.find((action) => action.type === 'staff')
  const announcement = packet.actions.find((action) => action.type === 'announcement')
  if (!room || !staff || !announcement) return []
  return [
    { id: 'receipt-room', kind: 'room-board', audience: 'operator', destination: 'Event room board', summary: `${room.target?.room} reserved ${room.target?.start}–${room.target?.end}.`, status: 'applied-to-demo', delivery: 'in-app simulation' },
    { id: 'receipt-staff', kind: 'staff-brief', audience: 'staff', destination: 'Staff briefing view', summary: `${staff.after.split(' · ')[0]} assigned to ${room.target?.room}.`, status: 'applied-to-demo', delivery: 'in-app simulation' },
    { id: 'receipt-attendees', kind: 'attendee-notice', audience: 'affected-attendees', destination: 'Attendee notice preview', summary: announcement.target?.message ?? announcement.after, status: 'applied-to-demo', delivery: 'in-app simulation' },
  ]
}

export function applyPublishedPacket(state: EventState, packet: DecisionPacket): EventState {
  const addressedIncidentIds = new Set(packet.actions.map((action) => action.incidentId))
  const incidents = state.incidents.map((incident) => addressedIncidentIds.has(incident.id) ? { ...incident, status: 'monitoring' as const, owner: 'Approved response' } : incident)
  const roomAction = packet.actions.find((action) => action.type === 'schedule')
  const roomName = roomAction?.target?.room ?? roomAction?.after.split(' · ')[0]
  const staffAction = packet.actions.find((action) => action.type === 'staff')
  const staffId = staffAction?.target?.staffId ?? state.staff.find((person) => person.name === staffAction?.after.split(' · ')[0])?.id
  const rooms = roomName ? state.rooms.map((room) => room.name === roomName ? { ...room, status: 'in-use' as const, note: 'Overflow support live' } : room) : state.rooms
  const staff = staffId ? state.staff.map((person) => person.id === staffId ? { ...person, status: 'assigned' as const, location: roomName ?? person.location } : person) : state.staff
  return { ...state, incidents, rooms, staff }
}

export function getSession(state: EventState, id: string): Session | undefined {
  return state.sessions.find((session) => session.id === id)
}

export function getIncident(state: EventState, id: string): Incident | undefined {
  return state.incidents.find((incident) => incident.id === id)
}
