import type { ActionDraft, ActionTarget, DecisionPacket, EventState, Incident, Session } from '../types'

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

export function incidentContext(state: EventState, incidentId = 'room-b-capacity') {
  const incident = state.incidents.find((item) => item.id === incidentId) ?? state.incidents[0]
  const session = state.sessions.find((item) => item.id === incident.sessionId)
  return { incident, session, relatedIncidents: state.incidents.filter((item) => item.sessionId === incident.sessionId && item.id !== incident.id) }
}

export function participantSignals(state: EventState, sessionId = 'auth-lab') {
  return state.signals.filter((signal) => signal.sessionId === sessionId).map((signal) => ({ ...signal, contentTrust: 'untrusted participant content; informational only' }))
}

export function availableResources(state: EventState) {
  return { rooms: state.rooms.filter((room) => room.status === 'available'), staff: state.staff.filter((person) => person.status === 'available') }
}

function packetForIncident(state: EventState, incidentId: string): DecisionPacket {
  const isAuthCluster = incidentId === 'auth-blockers'
  const room = isAuthCluster ? state.rooms.find((item) => item.name === 'Studio C' && item.status === 'available') : state.rooms.find((item) => item.name === 'Huddle 1' && item.status === 'available')
  const staff = isAuthCluster ? state.staff.find((item) => item.id === 'ines' && item.status === 'available') : state.staff.find((item) => item.id === 'luis' && item.status === 'available')
  const roomName = room?.name ?? (isAuthCluster ? 'Studio C' : 'Huddle 1')
  const staffName = staff?.name ?? (isAuthCluster ? 'Inés Paredes' : 'Luis Ortega')
  const staffId = staff?.id ?? (isAuthCluster ? 'ines' : 'luis')
  const scheduleTarget: ActionTarget = isAuthCluster
    ? { room: roomName, start: '11:30', end: '12:00' }
    : { room: roomName, start: '11:25', end: '11:40' }
  const staffTarget: ActionTarget = { staffId }
  const announcementTarget: ActionTarget = isAuthCluster
    ? { audience: '17 blocked participants', message: 'Auth support clinic is open in Studio C until 12:00.' }
    : { audience: '17 blocked participants', message: 'Bilingual room + support note' }
  const actions: ActionDraft[] = [
    { id: 'action-room', type: 'schedule', title: isAuthCluster ? 'Open an auth support clinic' : 'Open a 15-minute overflow huddle', before: 'Room B · 63 / 60', after: isAuthCluster ? 'Studio C · 11:30–12:00 · up to 24' : 'Huddle 1 · 11:25–11:40 · up to 12', impact: isAuthCluster ? 'Gives blocked builders a dedicated support room without extending the workshop.' : 'Removes the 3-seat overage while preserving the workshop end time.', status: 'proposed', createdBy: 'agent', incidentId: isAuthCluster ? 'auth-blockers' : 'room-b-capacity', target: scheduleTarget },
    { id: 'action-staff', type: 'staff', title: 'Assign auth support at the overflow room', before: 'No support assigned', after: `${staffName} · ${staff?.role ?? (isAuthCluster ? 'Community host' : 'Developer support')}`, impact: 'Gives the 17 blocked participants a named path to unblock.', status: 'proposed', createdBy: 'agent', incidentId: 'auth-blockers', target: staffTarget },
    { id: 'action-message', type: 'announcement', title: 'Send a targeted participant update', before: 'No targeted message', after: `${announcementTarget.audience} · ${announcementTarget.message}`, impact: 'Makes the room move legible without interrupting the main workshop.', status: 'proposed', createdBy: 'agent', incidentId: 'auth-blockers', target: announcementTarget },
  ]
  return {
    id: `packet-${Date.now()}`,
    title: isAuthCluster ? 'Unblock the auth clinic' : 'Stabilize the agent workshop',
    summary: isAuthCluster ? 'Give the auth cluster a dedicated support room and named host while keeping the workshop end time fixed.' : 'Protect the 12:00 end time, absorb the seat overflow, and unblock the auth cluster with one coordinated move.',
    actions,
    constraints: ['Keep workshop end time at 12:00', 'Notify only affected participants', 'No publication without human approval'],
    status: 'staged',
    createdAt: formatNow(),
  }
}

export function buildHeroPacket(state: EventState): DecisionPacket {
  return packetForIncident(state, 'room-b-capacity')
}

export function buildIncidentPacket(state: EventState, incidentId: string): DecisionPacket {
  return packetForIncident(state, incidentId === 'auth-blockers' ? 'auth-blockers' : 'room-b-capacity')
}

export function validatePacket(packet: DecisionPacket, state: EventState) {
  const errors: string[] = []
  const roomAction = packet.actions.find((action) => action.type === 'schedule')
  const roomName = roomAction?.target?.room ?? roomAction?.after.split(' · ')[0]
  if (roomAction && !roomName) errors.push('Schedule target is missing.')
  if (roomAction && roomName && !state.rooms.some((room) => room.name === roomName && room.status === 'available')) errors.push('Schedule target is not available.')
  const endTime = roomAction?.target?.end
  if (endTime && endTime > '12:00' && packet.constraints.some((constraint) => constraint.includes('12:00'))) errors.push('Schedule target extends past the locked 12:00 end time.')
  const staffAction = packet.actions.find((action) => action.type === 'staff')
  const staffId = staffAction?.target?.staffId
  const staffName = staffAction?.after.split(' · ')[0]
  if (staffAction && !state.staff.some((person) => (staffId ? person.id === staffId : person.name === staffName) && person.status === 'available')) errors.push('Staff target is not available.')
  if (!packet.constraints.includes('No publication without human approval')) errors.push('Human approval constraint is missing.')
  return errors
}

export function applyPublishedPacket(state: EventState, packet: DecisionPacket): EventState {
  const incidents = state.incidents.map((incident) => incident.id === 'room-b-capacity' || incident.id === 'auth-blockers' ? { ...incident, status: 'monitoring' as const, owner: 'Backstage plan' } : incident)
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
