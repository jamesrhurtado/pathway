import type { EventState } from '../types'

export const initialEvent: EventState = {
  version: 1,
  event: {
    id: 'lima-build-week',
    title: 'Lima Build Week',
    subtitle: 'OpenAI × local builder community',
    location: 'Centro de Convenciones · San Borja',
    date: 'AUG 28, 2026',
    currentTime: '11:18',
    currentMinutes: 678,
  },
  sessions: [
    { id: 'opening', title: 'Opening / Build brief', track: 'Main stage', room: 'Auditorio A', start: '09:00', end: '09:30', startMin: 540, endMin: 570, attendance: 84, capacity: 120, status: 'done' },
    { id: 'auth-lab', title: 'Workshop · Ship your first agent', track: 'Hands-on lab', room: 'Room B', start: '11:00', end: '12:00', startMin: 660, endMin: 720, attendance: 63, capacity: 60, status: 'live' },
    { id: 'founder-clinic', title: 'Founder clinic: first customers', track: 'Business', room: 'Mentor Lounge', start: '11:30', end: '12:15', startMin: 690, endMin: 735, attendance: 18, capacity: 24, status: 'upcoming' },
    { id: 'demo-hour', title: 'Demo hour', track: 'Main stage', room: 'Auditorio A', start: '13:00', end: '14:00', startMin: 780, endMin: 840, attendance: 41, capacity: 120, status: 'upcoming' },
  ],
  incidents: [
    { id: 'room-b-capacity', title: 'Room B over capacity', severity: 'critical', status: 'open', room: 'Room B', sessionId: 'auth-lab', age: '08 min', detail: '63 checked in for 60 seats. Three participants are standing at the back.', owner: 'Unassigned' },
    { id: 'auth-blockers', title: '17 attendees cannot sign in', severity: 'warning', status: 'open', room: 'Room B', sessionId: 'auth-lab', age: '06 min', detail: 'Seventeen attendees cannot sign in to the workshop exercise and need a clear support path.', owner: 'Unassigned' },
    { id: 'workshop-lag', title: 'Workshop running 12 min late', severity: 'warning', status: 'monitoring', room: 'Room B', sessionId: 'auth-lab', age: '04 min', detail: 'Facilitator requested a short extension without moving the end of the event.', owner: 'Mariana V.' },
    { id: 'projector-b', title: 'Projector B signal intermittent', severity: 'watch', status: 'open', room: 'Room B', sessionId: 'auth-lab', age: '02 min', detail: 'Signal recovered twice. AV kit is nearby if the fault repeats.', owner: 'AV desk' },
  ],
  signals: [
    { id: 'signal-auth', topic: 'Workshop sign-in', count: 17, delta: '+9 in 8 min', sentiment: 'blocked', sessionId: 'auth-lab', sample: '“My callback URL is accepted but the session never returns.”', source: 'participant chat · untrusted' },
    { id: 'signal-seats', topic: 'Finding a seat', count: 6, delta: '+6 in 5 min', sentiment: 'confused', sessionId: 'auth-lab', sample: '“Is there another room for the lab?”', source: 'QR check-in notes · untrusted' },
    { id: 'signal-energy', topic: 'Build momentum', count: 31, delta: '+12 today', sentiment: 'positive', sessionId: 'auth-lab', sample: '“The live coding format is clicking.”', source: 'participant pulse · untrusted' },
  ],
  rooms: [
    { id: 'room-b', name: 'Room B', type: 'room', capacity: 60, availableFrom: 'now', status: 'in-use', note: 'Hands-on lab · 63/60', access: 'step-free' },
    { id: 'studio-c', name: 'Studio C', type: 'room', capacity: 24, availableFrom: '11:25', availableUntil: '11:50', status: 'available', note: 'Closest step-free room · keynote rehearsal at 11:50', access: 'step-free' },
    { id: 'atrium-annex', name: 'Atrium Annex', type: 'room', capacity: 22, availableFrom: '11:30', status: 'available', note: 'Step-free fallback · five-minute setup', access: 'step-free' },
    { id: 'breakout-a', name: 'Breakout Room A', type: 'room', capacity: 12, availableFrom: 'now', status: 'available', note: 'Closest spare classroom · stairs only', access: 'stairs-only' },
    { id: 'av-kit-2', name: 'AV kit 02', type: 'kit', capacity: 0, availableFrom: 'now', status: 'available', note: 'HDMI bridge + spare power', access: 'step-free' },
  ],
  staff: [
    { id: 'mariana', name: 'Mariana Vega', role: 'Workshop lead', status: 'in-session', specialties: ['facilitation', 'agents'], location: 'Room B' },
    { id: 'luis', name: 'Luis Ortega', role: 'Developer support', status: 'available', specialties: ['auth', 'APIs'], location: 'Staff bench', availableUntil: '11:50' },
    { id: 'ines', name: 'Inés Paredes', role: 'Community host', status: 'available', specialties: ['check-in', 'auth triage', 'Spanish / English'], location: 'Lobby' },
    { id: 'rafael', name: 'Rafael Quispe', role: 'AV + room ops', status: 'available', specialties: ['AV', 'room moves'], location: 'AV desk' },
  ],
  constraints: [
    { id: 'constraint-end', label: 'Workshop ends at 12:00', detail: 'The room response cannot extend the workshop.', source: 'Run of show · organizer lock' },
    { id: 'constraint-access', label: 'Step-free route required', detail: 'One affected attendee uses a wheelchair; any overflow room must be step-free.', source: 'Accessibility desk · verified accommodation' },
    { id: 'constraint-turnover', label: 'Studio C clears by 11:50', detail: 'A keynote rehearsal has a hard room turnover at 11:50.', source: 'Production schedule · room lock' },
  ],
}
