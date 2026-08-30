export type Severity = 'critical' | 'warning' | 'watch'
export type IncidentStatus = 'open' | 'monitoring' | 'resolved'
export type PlanStatus = 'staged' | 'approved' | 'applied'
export type ActionType = 'schedule' | 'staff' | 'announcement'

export interface Session {
  id: string
  title: string
  track: string
  room: string
  start: string
  end: string
  startMin: number
  endMin: number
  attendance: number
  capacity: number
  status: 'live' | 'upcoming' | 'done'
}

export interface Incident {
  id: string
  title: string
  severity: Severity
  status: IncidentStatus
  room: string
  sessionId: string
  age: string
  detail: string
  owner: string
}

export interface SignalCluster {
  id: string
  topic: string
  count: number
  delta: string
  sentiment: 'blocked' | 'confused' | 'positive'
  sessionId: string
  sample: string
  source: string
}

export interface RoomResource {
  id: string
  name: string
  type: 'room' | 'kit'
  capacity: number
  availableFrom: string
  status: 'available' | 'in-use' | 'held'
  note: string
  access: 'step-free' | 'stairs-only'
  availableUntil?: string
}

export interface StaffResource {
  id: string
  name: string
  role: string
  status: 'available' | 'assigned' | 'in-session'
  specialties: string[]
  location: string
  availableUntil?: string
}

export interface OperationalConstraint {
  id: string
  label: string
  detail: string
  source: string
}

export interface ActionDraft {
  id: string
  type: ActionType
  title: string
  before: string
  after: string
  impact: string
  status: 'proposed' | 'edited' | 'confirmed'
  createdBy: 'agent' | 'human'
  incidentId: string
  /** Machine-readable values used to validate and apply the staged action. */
  target?: ActionTarget
}

export interface ActionTarget {
  room?: string
  start?: string
  end?: string
  staffId?: string
  audience?: string
  message?: string
}

export interface PacketEvidence {
  id: string
  label: string
  detail: string
  source: string
  observedAt: string
  trust: 'trusted' | 'untrusted'
}

export interface PacketAlternative {
  id: string
  label: string
  outcome: string
  disruption: string
  decision: 'selected' | 'rejected'
}

export interface PacketMetrics {
  signInReports: number
  seatShortfallResolved: number
  constraintChecks: number
  coordinatedActions: number
}

export interface DispatchReceipt {
  id: string
  kind: 'room-board' | 'staff-brief' | 'attendee-notice'
  audience: 'operator' | 'staff' | 'affected-attendees'
  destination: string
  summary: string
  status: 'applied-to-demo'
  delivery: 'in-app simulation'
  responseRevision: string
}

export interface DecisionPacket {
  id: string
  title: string
  summary: string
  actions: ActionDraft[]
  constraints: string[]
  evidence: PacketEvidence[]
  alternatives: PacketAlternative[]
  metrics: PacketMetrics
  status: PlanStatus
  revision: number
  revisionId: string
  stateVersion: number
  createdAt: string
  approvedBy?: string
  approvedRevisionId?: string
  appliedAt?: string
}

export interface ActivityItem {
  id: string
  time: string
  actor: 'agent' | 'human' | 'system'
  label: string
  detail: string
  kind: 'read' | 'stage' | 'approval' | 'apply' | 'rollback' | 'system'
}

export interface EventState {
  version: number
  event: {
    id: string
    title: string
    subtitle: string
    location: string
    date: string
    currentTime: string
    currentMinutes: number
  }
  sessions: Session[]
  incidents: Incident[]
  signals: SignalCluster[]
  rooms: RoomResource[]
  staff: StaffResource[]
  constraints: OperationalConstraint[]
}

export interface DraftResponseUpdate {
  room?: string
  start?: string
  end?: string
  staffId?: string
  audience?: string
  message?: string
  reason: string
}
