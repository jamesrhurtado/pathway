import type { EventState } from '../types'

export const initialEvent: EventState = {
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
    { id: 'founder-clinic', title: 'Founder clinic: first customers', track: 'Business', room: 'Studio C', start: '11:30', end: '12:15', startMin: 690, endMin: 735, attendance: 18, capacity: 24, status: 'upcoming' },
    { id: 'demo-hour', title: 'Demo hour', track: 'Main stage', room: 'Auditorio A', start: '13:00', end: '14:00', startMin: 780, endMin: 840, attendance: 41, capacity: 120, status: 'upcoming' },
  ],
  incidents: [
    { id: 'room-b-capacity', title: 'Room B over capacity', severity: 'critical', status: 'open', room: 'Room B', sessionId: 'auth-lab', age: '08 min', detail: '63 checked in for 60 seats. Three participants are standing at the back.', owner: 'Unassigned' },
    { id: 'auth-blockers', title: '17 participants blocked on auth', severity: 'warning', status: 'open', room: 'Room B', sessionId: 'auth-lab', age: '06 min', detail: 'A cluster of setup questions is slowing the lab and could compound the over-capacity issue.', owner: 'Unassigned' },
    { id: 'workshop-lag', title: 'Workshop running 12 min late', severity: 'warning', status: 'monitoring', room: 'Room B', sessionId: 'auth-lab', age: '04 min', detail: 'Facilitator requested a short extension without moving the end of the event.', owner: 'Mariana V.' },
    { id: 'projector-b', title: 'Projector B signal intermittent', severity: 'watch', status: 'open', room: 'Room B', sessionId: 'auth-lab', age: '02 min', detail: 'Signal recovered twice. AV kit is nearby if the fault repeats.', owner: 'AV desk' },
  ],
  signals: [
    { id: 'signal-auth', topic: 'Authentication setup', count: 17, delta: '+9 in 8 min', sentiment: 'blocked', sessionId: 'auth-lab', sample: '“My callback URL is accepted but the session never returns.”', source: 'participant chat · untrusted' },
    { id: 'signal-seats', topic: 'Finding a seat', count: 6, delta: '+6 in 5 min', sentiment: 'confused', sessionId: 'auth-lab', sample: '“Is there another room for the lab?”', source: 'QR check-in notes · untrusted' },
    { id: 'signal-energy', topic: 'Build momentum', count: 31, delta: '+12 today', sentiment: 'positive', sessionId: 'auth-lab', sample: '“The live coding format is clicking.”', source: 'participant pulse · untrusted' },
  ],
  rooms: [
    { id: 'room-b', name: 'Room B', type: 'room', capacity: 60, availableFrom: 'now', status: 'in-use', note: 'Hands-on lab · 63/60' },
    { id: 'studio-c', name: 'Studio C', type: 'room', capacity: 24, availableFrom: '11:25', status: 'available', note: 'Opens after founder clinic setup' },
    { id: 'huddle-1', name: 'Huddle 1', type: 'room', capacity: 12, availableFrom: 'now', status: 'available', note: 'Quiet room · no projector' },
    { id: 'av-kit-2', name: 'AV kit 02', type: 'kit', capacity: 0, availableFrom: 'now', status: 'available', note: 'HDMI bridge + spare power' },
  ],
  staff: [
    { id: 'mariana', name: 'Mariana Vega', role: 'Workshop lead', status: 'in-session', specialties: ['facilitation', 'agents'], location: 'Room B' },
    { id: 'luis', name: 'Luis Ortega', role: 'Developer support', status: 'available', specialties: ['auth', 'APIs'], location: 'Staff bench' },
    { id: 'ines', name: 'Inés Paredes', role: 'Community host', status: 'available', specialties: ['check-in', 'Spanish / English'], location: 'Lobby' },
    { id: 'rafael', name: 'Rafael Quispe', role: 'AV + room ops', status: 'available', specialties: ['AV', 'room moves'], location: 'AV desk' },
  ],
}
