import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowUpRight, Bot, Check, ChevronRight, CircleHelp, Clock3, Crosshair, DoorOpen, Flag, Gauge, Headphones, History, LayoutGrid, Lock, MessageSquare, Play, Radio, RotateCcw, Send, ShieldCheck, Sparkles, UserRound, Users, Wrench, X } from 'lucide-react'
import { initialEvent } from './data/demoEvent'
import { applyPublishedPacket, availableResources, buildHeroPacket, buildIncidentPacket, eventHealth, incidentContext, participantSignals, validatePacket } from './lib/eventEngine'
import { registerBackstageTools } from './lib/webmcp'
import type { ActionDraft, ActivityItem, DecisionPacket, EventState, Incident } from './types'

const time = '11:18'

type ToolTraceEntry = {
  id: string
  time: string
  name: string
  input: unknown
  status: 'success' | 'error'
}

function App() {
  const [state, setState] = useState<EventState>(initialEvent)
  const [selectedIncidentId, setSelectedIncidentId] = useState('room-b-capacity')
  const [packet, setPacket] = useState<DecisionPacket>()
  const [activity, setActivity] = useState<ActivityItem[]>([
    { id: 'a1', time: '11:18:03', actor: 'system', label: 'Signal cluster updated', detail: '17 authentication blockers grouped from participant chat', kind: 'system' },
    { id: 'a2', time: '11:17:42', actor: 'human', label: 'Incident opened', detail: 'Room B over capacity · 63 / 60', kind: 'stage' },
    { id: 'a3', time: '11:16:19', actor: 'system', label: 'Workshop heartbeat', detail: 'Agent lab is live · 12 min behind run-of-show', kind: 'read' },
  ])
  const [toast, setToast] = useState('')
  const [locked, setLocked] = useState(true)
  const [tools, setTools] = useState<string[]>([])
  const [webMcpSupported, setWebMcpSupported] = useState(false)
  const [toolTrace, setToolTrace] = useState<ToolTraceEntry[]>([])

  const selectedIncident = state.incidents.find((incident) => incident.id === selectedIncidentId) ?? state.incidents[0]
  const health = eventHealth(state)
  const validation = packet && packet.status !== 'published' ? validatePacket(packet, state) : []

  const log = useCallback((entry: Omit<ActivityItem, 'id' | 'time'>) => {
    setActivity((items) => [{ ...entry, id: crypto.randomUUID(), time: new Date().toLocaleTimeString('en-GB', { hour12: false }) }, ...items].slice(0, 8))
  }, [])
  const notify = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3600) }, [])
  const recordTool = useCallback((entry: { name: string; input: unknown; result: unknown; status: 'success' | 'error' }) => {
    setToolTrace((items) => [{ id: crypto.randomUUID(), time: new Date().toLocaleTimeString('en-GB', { hour12: false }), name: entry.name, input: entry.input, status: entry.status }, ...items].slice(0, 12))
  }, [])

  const stageHero = useCallback(() => {
    const next = buildHeroPacket(state)
    setPacket(next)
    setLocked(true)
    log({ actor: 'agent', label: 'Decision packet staged', detail: 'Three coordinated actions · publication still locked', kind: 'stage' })
    notify('Packet staged for human review')
  }, [log, notify, state])

  const stagePacket = useCallback((input?: { incidentId?: string }) => {
    if (packet) return { ok: false, error: 'A decision packet already exists. Review it or reset the rehearsal before creating another.' }
    const next = buildIncidentPacket(state, input?.incidentId ?? 'room-b-capacity')
    setPacket(next)
    setLocked(true)
    log({ actor: 'agent', label: 'Decision packet staged', detail: 'Three coordinated actions · publication still locked', kind: 'stage' })
    return { ok: true, status: 'staged', packet: next }
  }, [log, packet, state])

  const stageIncident = useCallback((incidentId: string) => {
    if (packet && packet.status !== 'staged') {
      notify('Reset the current packet before staging another incident response')
      return
    }
    const next = buildIncidentPacket(state, incidentId)
    setPacket(next)
    setLocked(true)
    log({ actor: 'agent', label: 'Incident response staged', detail: `${next.actions.length} coordinated actions · publication still locked`, kind: 'stage' })
    notify(`${next.title} staged for review`)
  }, [log, notify, state])

  const stageSchedule = useCallback((input: { room?: string; start?: string; end?: string }) => {
    if (!packet || packet.status !== 'staged') return { ok: false, error: 'Only a staged packet can be edited. Human approval or publication must be reset first.' }
    const room = input.room ?? 'Huddle 1'
    if (!state.rooms.some((item) => item.name === room && item.status === 'available')) return { ok: false, error: `${room} is not available.` }
    const start = input.start ?? '11:25'
    const end = input.end ?? '11:40'
    setPacket((current) => current ? { ...current, actions: current.actions.map((action) => action.type === 'schedule' ? { ...action, after: `${room} · ${start}–${end}`, status: 'edited', createdBy: 'agent', target: { ...action.target, room, start, end } } : action) } : current)
    log({ actor: 'agent', label: 'Schedule action revised', detail: `${room} reserved as overflow`, kind: 'stage' })
    return { ok: true, room }
  }, [log, packet, state.rooms])

  const stageStaff = useCallback((input: { staffId?: string; staffName?: string }) => {
    if (!packet || packet.status !== 'staged') return { ok: false, error: 'Only a staged packet can be edited. Human approval or publication must be reset first.' }
    if (!input.staffId && !input.staffName) return { ok: false, error: 'Provide a staffId or staffName.' }
    const person = state.staff.find((item) => item.id === input.staffId || item.name === input.staffName)
    if (!person || person.status !== 'available') return { ok: false, error: 'That staff member is not available.' }
    setPacket((current) => current ? { ...current, actions: current.actions.map((action) => action.type === 'staff' ? { ...action, after: `${person.name} · ${person.role}`, status: 'edited', createdBy: 'agent', target: { ...action.target, staffId: person.id } } : action) } : current)
    log({ actor: 'agent', label: 'Staff action revised', detail: `${person.name} assigned in the staged packet`, kind: 'stage' })
    return { ok: true, staff: person.name }
  }, [log, packet, state.staff])

  const stageAnnouncement = useCallback((input: { audience?: string; message?: string }) => {
    if (!packet || packet.status !== 'staged') return { ok: false, error: 'Only a staged packet can be edited. Human approval or publication must be reset first.' }
    const audience = input.audience ?? '17 blocked participants'
    const message = input.message ?? 'Bilingual room + support note'
    setPacket((current) => current ? { ...current, actions: current.actions.map((action) => action.type === 'announcement' ? { ...action, after: `${audience} · ${message}`, status: 'edited', createdBy: 'agent', target: { ...action.target, audience, message } } : action) } : current)
    log({ actor: 'agent', label: 'Announcement action revised', detail: 'Message remains staged and unsent', kind: 'stage' })
    return { ok: true }
  }, [log, packet])

  const reviewPlan = useCallback(() => packet ? { packet, validation: validatePacket(packet, state), publication: packet.status === 'approved' ? 'available' : 'locked' } : { packet: null, validation: ['No staged packet'], publication: 'locked' }, [packet, state])
  const revisePlan = useCallback((input: { actionId: string; instruction: string }) => {
    if (!packet || packet.status !== 'staged') return { ok: false, error: 'Only a staged packet can be revised. Approval must be renewed after edits.' }
    const action = packet.actions.find((item) => item.id === input.actionId)
    if (!action) return { ok: false, error: `No staged action found for ${input.actionId}.` }
    if (action.type === 'staff') {
      const person = state.staff.find((item) => item.status === 'available' && input.instruction.toLowerCase().includes(item.name.toLowerCase()))
      if (!person) return { ok: false, error: 'Include the full name of an available staff member in the revision.' }
      setPacket((current) => current ? { ...current, actions: current.actions.map((item) => item.id === action.id ? { ...item, after: `${person.name} · ${person.role}`, status: 'edited', createdBy: 'agent', target: { ...item.target, staffId: person.id } } : item) } : current)
    } else if (action.type === 'schedule') {
      const room = state.rooms.find((item) => item.status === 'available' && input.instruction.toLowerCase().includes(item.name.toLowerCase()))
      if (!room) return { ok: false, error: 'Include the name of an available room in the schedule revision.' }
      setPacket((current) => current ? { ...current, actions: current.actions.map((item) => item.id === action.id ? { ...item, after: `${room.name} · ${item.target?.start ?? '11:25'}–${item.target?.end ?? '11:40'}`, status: 'edited', createdBy: 'agent', target: { ...item.target, room: room.name } } : item) } : current)
    } else {
      setPacket((current) => current ? { ...current, actions: current.actions.map((item) => item.id === action.id ? { ...item, after: `${item.target?.audience ?? '17 blocked participants'} · ${input.instruction}`, status: 'edited', createdBy: 'agent', target: { ...item.target, message: input.instruction } } : item) } : current)
    }
    log({ actor: 'agent', label: 'Staged action revised', detail: input.instruction, kind: 'stage' })
    return { ok: true }
  }, [log, packet, state.rooms, state.staff])
  const publishPlan = useCallback(() => {
    if (!packet || packet.status !== 'approved') return { ok: false, error: 'Human approval is required.' }
    const currentValidation = validatePacket(packet, state)
    if (currentValidation.length) return { ok: false, error: `Approval is stale: ${currentValidation.join(' ')}` }
    setState((current) => applyPublishedPacket(current, packet))
    setPacket((current) => current ? { ...current, status: 'published', publishedAt: time } : current)
    log({ actor: 'human', label: 'Decision packet published', detail: 'Room move, staff assignment, and targeted note are live', kind: 'publish' })
    notify('Published atomically to the live event')
    return { ok: true, status: 'published' }
  }, [log, notify, packet, state])

  const bridge = useMemo(() => ({ state, stagedPlan: packet, approved: packet?.status === 'approved', stagePacket, stageSchedule, stageStaff, stageAnnouncement, reviewPlan, revisePlan, publishPlan, recordTool }), [packet, publishPlan, recordTool, revisePlan, reviewPlan, stageAnnouncement, stagePacket, stageSchedule, stageStaff, state])
  useEffect(() => {
    const result = registerBackstageTools(bridge)
    setWebMcpSupported(result.supported)
    setTools(result.names)
    return result.cleanup
  }, [bridge])

  const approve = () => {
    if (!packet || validation.length) return
    setPacket({ ...packet, status: 'approved', approvedBy: 'You · event lead' })
    log({ actor: 'human', label: 'Packet approved', detail: 'Publish capability unlocked', kind: 'approval' })
    notify('Approved — publish is now available')
  }
  const reset = () => { setState(initialEvent); setPacket(undefined); setSelectedIncidentId('room-b-capacity'); setLocked(true); setTools([]); setToolTrace([]); notify('Demo state reset') }
  const lockConstraint = () => {
    if (packet && packet.status !== 'staged') { notify('Reset the packet before changing its constraints'); return }
    const nextLocked = !locked
    setLocked(nextLocked)
    setPacket((current) => current ? { ...current, constraints: nextLocked ? Array.from(new Set([...current.constraints, 'Keep workshop end time at 12:00'])) : current.constraints.filter((constraint) => constraint !== 'Keep workshop end time at 12:00') } : current)
    notify(nextLocked ? 'End-time constraint locked' : 'End-time constraint unlocked')
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Crosshair size={16} /></span><span>BACKSTAGE</span><span className="brand-slash">/</span><span className="brand-sub">OPERATIONS DESK</span></div>
      <div className="topbar-event"><span className="live-dot" />LIVE <span className="mono">{time}</span><span className="topbar-divider" />{state.event.title}<span className="muted">· {state.event.location}</span></div>
      <div className="topbar-actions"><span className={`webmcp-status ${webMcpSupported ? 'is-live' : ''}`}><span className="status-dot" />WebMCP {webMcpSupported ? 'connected' : 'preview'}</span><button className="icon-button" onClick={reset} aria-label="Reset demo"><RotateCcw size={16} /></button><div className="avatar">JM</div></div>
    </header>

    <main className="main-wrap">
      <section className="hero-grid">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" />LIVE EVENT TWIN <span className="mono">/ {state.event.date}</span></div><h1>Keep the room moving.<br /><em>Leave the final call human.</em></h1><p>Backstage is a seeded rehearsal of an event operations desk. The twin starts with Room B at 63 / 60 seats and 17 builders blocked on authentication. Nothing leaves this page: publishing applies the approved proposal to this in-memory event twin.</p><div className="hero-command"><div className="command-icon"><Bot size={18} /></div><div className="command-text"><span className="command-label">TRY THE HERO SCENARIO · NO EXTERNAL SEND</span><span>“Room B is over capacity and 17 builders are blocked on auth. Find the least disruptive response, but don’t publish.”</span></div><button className="primary-button" onClick={stageHero}><Play size={15} fill="currentColor" /> Run rehearsal</button></div></div>
        <div className="hero-aside"><div className="health-ring"><div className="health-number">{health}</div><div className="health-label">/ 100<br /><span>event health</span></div></div><div className="aside-copy"><span className="eyebrow">OPS READ</span><strong>{health > 80 ? 'Stable with an active edge' : 'Needs operator attention'}</strong><span>One critical incident is contained; the next move is staged, not assumed.</span></div><div className="hero-aside-footer"><span><Radio size={14} /> {state.sessions.filter((item) => item.status === 'live').length} room live</span><span><Clock3 size={14} /> next handoff 11:25</span></div></div>
      </section>

      <section className="demo-explainer panel" aria-label="How this rehearsal works"><div className="demo-explainer-copy"><span className="eyebrow">DEMO MODE · LOCAL EVENT TWIN</span><strong>This is a safe rehearsal, not a messaging integration.</strong><span>Reset returns the fictional Lima Build Week to its starting state. A decision packet is a reviewable proposal. Approve gives the human the final say; Publish applies only that approved proposal to the simulated rooms, staffing, incidents, and activity history below.</span></div><div className="demo-steps"><span><b>01</b> Observe live context</span><span><b>02</b> Stage a proposal</span><span><b>03</b> Human approves</span><span><b>04</b> Apply to event twin</span></div></section>

      <section className="metric-strip" aria-label="Event metrics"><Metric label="PARTICIPANTS" value="248" delta="+18 today" icon={<Users size={15} />} /><Metric label="SESSIONS" value={`${state.sessions.filter((item) => item.status === 'live').length} / ${state.sessions.length}`} delta="1 in motion" icon={<LayoutGrid size={15} />} /><Metric label="OPEN INCIDENTS" value={String(state.incidents.filter((item) => item.status !== 'resolved').length)} delta="1 critical" tone="critical" icon={<AlertTriangle size={15} />} /><Metric label="AGENT TOOLS" value={String(tools.length || 4)} delta={webMcpSupported ? 'registered now' : 'ready to register'} icon={<Wrench size={15} />} /></section>

      <section className="workbench-grid">
        <div className="pulse-rail panel"><PanelHeading icon={<Activity size={15} />} title="Live pulse" meta="chronological signal" /><div className="timeline"><TimelineItem time="11:18" tone="critical" title="Room B over capacity" detail="63 checked in · 60 seats · 3 standing" badge="CRITICAL" /><TimelineItem time="11:16" tone="warning" title="Auth blockers clustering" detail="17 participant signals · +9 in 8 min" badge="ATTENTION" /><TimelineItem time="11:13" tone="neutral" title="Workshop heartbeat" detail="Ship your first agent · 12 min behind" badge="MONITORING" /><TimelineItem time="11:08" tone="positive" title="Main stage reset" detail="Opening room cleared on schedule" badge="CLEAR" /></div><div className="rail-footer"><span className="mono">LAST SYNC {time}:03</span><span className="sync-state"><span className="status-dot" /> synced</span></div></div>
        <div className="incident-panel panel"><PanelHeading icon={<Flag size={15} />} title="Incident command queue" meta={`${state.incidents.length} signals`} /><div className="incident-list">{state.incidents.map((incident) => <IncidentRow key={incident.id} incident={incident} selected={incident.id === selectedIncidentId} onClick={() => setSelectedIncidentId(incident.id)} />)}</div><div className="incident-detail"><div className="detail-head"><div><span className={`severity-label ${selectedIncident.severity}`}>{selectedIncident.severity.toUpperCase()}</span><h3>{selectedIncident.title}</h3></div><span className="mono muted">{selectedIncident.age}</span></div><p>{selectedIncident.detail}</p><div className="detail-facts"><span><DoorOpen size={13} /> {selectedIncident.room}</span><span><UserRound size={13} /> {selectedIncident.owner}</span><span><CircleHelp size={13} /> {selectedIncident.status}</span></div><button className="text-button" onClick={() => stageIncident(selectedIncident.id)} aria-label={`Stage a response for ${selectedIncident.title}`}><Sparkles size={13} /> Stage response for this incident <ArrowUpRight size={14} /></button></div></div>
      </section>

      <section className="secondary-grid">
        <div className="signals-panel panel"><PanelHeading icon={<MessageSquare size={15} />} title="Participant pulse" meta="untrusted input · clustered" /><div className="signal-list">{participantSignals(state).map((signal) => <div className="signal-row" key={signal.id}><div className={`signal-icon ${signal.sentiment}`}><MessageSquare size={14} /></div><div className="signal-body"><div className="signal-title"><strong>{signal.topic}</strong><span className="mono">{signal.count}</span></div><span>{signal.sample}</span><small>{signal.source} · {signal.delta}</small></div></div>)}</div></div>
        <div className="bench-panel panel"><PanelHeading icon={<Headphones size={15} />} title="Resource bench" meta="available now" /><div className="bench-columns"><div><span className="bench-label">ROOMS + KITS</span>{availableResources(state).rooms.map((resource) => <ResourceRow key={resource.id} title={resource.name} detail={resource.note} icon={resource.type === 'room' ? <DoorOpen size={14} /> : <Wrench size={14} />} />)}</div><div><span className="bench-label">PEOPLE</span>{availableResources(state).staff.map((person) => <ResourceRow key={person.id} title={person.name} detail={person.specialties.join(' · ')} icon={<UserRound size={14} />} />)}</div></div><button className="text-button" onClick={() => { setSelectedIncidentId('auth-blockers'); notify('Resource context pinned to auth blockers') }}>Inspect bench context <ArrowUpRight size={14} /></button></div>
      </section>

      <section className="packet-section panel"><div className="packet-top"><PanelHeading icon={<Sparkles size={15} />} title="Decision packet" meta={packet ? `${packet.status} · ${packet.actions.length} actions · ${packet.evidence.length} proofs` : 'no staged intervention'} /><div className="packet-actions"><button className="ghost-button" onClick={lockConstraint}><Lock size={14} /> {locked ? 'End time locked' : 'Lock end time'}</button>{packet && packet.status === 'staged' && <button className="primary-button small" onClick={approve} disabled={validation.length > 0}><Check size={14} /> Approve packet</button>}{packet?.status === 'approved' && <button className="publish-button" onClick={() => publishPlan()}><Send size={14} /> Publish to event twin</button>}</div></div>{packet ? <><div className="packet-intro"><div><h2>{packet.title}</h2><p>{packet.summary}</p><div className="packet-mode-note"><Lock size={12} /> Proposal only — no room, staff, or participant state changes until the human approves and publishes.</div></div><div className="constraint-stack">{packet.constraints.map((constraint) => <span className={`constraint ${constraint.includes('end') && locked ? 'locked' : ''}`} key={constraint}><Lock size={11} /> {constraint}</span>)}</div></div><div className="packet-proof-grid"><div className="proof-panel"><div className="proof-heading"><ShieldCheck size={14} /><span>Evidence used</span><span className="mono">{packet.evidence.length} sources</span></div>{packet.evidence.map((item) => <div className="proof-row" key={item.id}><span className={`proof-trust ${item.trust}`}>{item.trust === 'trusted' ? 'TRUSTED' : 'UNTRUSTED'}</span><div><strong>{item.label}</strong><span>{item.detail}</span><small>{item.source} · observed {item.observedAt}</small></div></div>)}</div><div className="proof-panel"><div className="proof-heading"><ArrowUpRight size={14} /><span>Alternatives considered</span><span className="mono">least disruption</span></div>{packet.alternatives.map((alternative) => <div className={`alternative-row ${alternative.decision}`} key={alternative.id}><span className="alternative-mark">{alternative.decision === 'selected' ? '✓' : '×'}</span><div><strong>{alternative.label}</strong><span>{alternative.outcome}</span><small>{alternative.disruption}</small></div><span className="alternative-decision">{alternative.decision}</span></div>)}</div></div><div className="impact-strip"><Metric label="AFFECTED" value={String(packet.metrics.affectedParticipants)} delta="participants" icon={<Users size={15} />} /><Metric label="CAPACITY RELIEF" value={`−${packet.metrics.capacityRelieved}`} delta="seats / blockers" icon={<Gauge size={15} />} /><Metric label="TIME TO STAGE" value={`${packet.metrics.minutesToStage}m`} delta="deterministic replay" icon={<Clock3 size={15} />} /><Metric label="CONSTRAINTS" value={String(packet.metrics.constraintChecks)} delta="checks passed" icon={<ShieldCheck size={15} />} /></div><div className="action-grid">{packet.actions.map((action) => <ActionCard key={action.id} action={action} />)}</div>{validation.length > 0 && <div className="validation-warning"><AlertTriangle size={14} /> {validation.join(' ')}</div>}</> : <div className="empty-packet"><div className="empty-icon"><Bot size={20} /></div><div><strong>No proposal staged</strong><span>A packet is a proposed set of room, staffing, and communication changes. It stays local until a human approves it.</span></div><span className="packet-lock"><Lock size={14} /> publish unavailable</span></div>}</section>

        <section className="bottom-grid"><div className="activity-panel panel"><PanelHeading icon={<History size={15} />} title="Activity history" meta="human + agent" /><div className="activity-list">{activity.map((item) => <div className="activity-row" key={item.id}><span className={`activity-dot ${item.kind}`} /><span className="mono activity-time">{item.time}</span><div><strong>{item.label}</strong><span>{item.detail}</span></div><span className={`actor-tag ${item.actor}`}>{item.actor}</span></div>)}</div></div><div className="tool-panel panel"><PanelHeading icon={<Wrench size={15} />} title="WebMCP tool map" meta={webMcpSupported ? 'live registration' : 'browser preview'} /><div className="tool-list">{(tools.length ? tools : ['get_live_event_state', 'inspect_incident', 'inspect_participant_signals', 'find_available_resources', 'stage_decision_packet']).map((tool) => <div className="tool-row" key={tool}><span className="tool-state" /><code>{tool}</code><span className="tool-kind">{tool.startsWith('stage_') || tool.includes('publish') || tool.startsWith('revise_') ? 'WRITE' : 'READ'}</span></div>)}</div><div className="tool-note"><ShieldCheck size={14} /> Writes are staged; publication appears only after approval.</div></div><div className="flight-panel panel"><PanelHeading icon={<Radio size={15} />} title="Agent flight recorder" meta={`${toolTrace.length} calls captured`} /><div className="trace-list">{toolTrace.length ? toolTrace.map((entry) => <div className="trace-row" key={entry.id}><span className={`trace-dot ${entry.status}`} /><span className="mono trace-time">{entry.time}</span><div><code>{entry.name}</code><span>{entry.status === 'success' ? 'completed' : 'rejected'} · {formatTraceInput(entry.input)}</span></div></div>) : <div className="trace-empty"><Bot size={15} /><span>Ask a browser agent to run the scenario. Tool inputs, outcomes, and rejected attempts will appear here.</span></div>}</div><div className="tool-note"><ShieldCheck size={14} /> A human approval event is always visible before publication.</div></div></section>
    </main>
    {toast && <div className="toast" role="status"><Check size={15} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={13} /></button></div>}
  </div>
}

function Metric({ label, value, delta, icon, tone = '' }: { label: string; value: string; delta: string; icon: React.ReactNode; tone?: string }) { return <div className="metric"><div className="metric-icon">{icon}</div><div><span className="metric-label">{label}</span><strong className={tone}>{value}</strong><span className={`metric-delta ${tone}`}>{delta}</span></div></div> }
function PanelHeading({ icon, title, meta }: { icon: React.ReactNode; title: string; meta: string }) { return <div className="panel-heading"><div className="heading-title"><span className="heading-icon">{icon}</span><h2>{title}</h2></div><span className="panel-meta">{meta}</span></div> }
function TimelineItem({ time, tone, title, detail, badge }: { time: string; tone: string; title: string; detail: string; badge: string }) { return <div className="timeline-item"><span className={`timeline-marker ${tone}`} /><span className="mono timeline-time">{time}</span><div><strong>{title}</strong><span>{detail}</span></div><span className={`timeline-badge ${tone}`}>{badge}</span></div> }
function IncidentRow({ incident, selected, onClick }: { incident: Incident; selected: boolean; onClick: () => void }) { return <button className={`incident-row ${selected ? 'selected' : ''}`} onClick={onClick}><span className={`incident-severity ${incident.severity}`} /><span className="incident-main"><strong>{incident.title}</strong><span>{incident.room} · {incident.status}</span></span><span className="mono incident-age">{incident.age}</span><ChevronRight size={15} /></button> }
function ResourceRow({ title, detail, icon }: { title: string; detail: string; icon: React.ReactNode }) { return <div className="resource-row"><span className="resource-icon">{icon}</span><div><strong>{title}</strong><span>{detail}</span></div><span className="available-dot" /></div> }
function ActionCard({ action }: { action: ActionDraft }) { const Icon = action.type === 'schedule' ? DoorOpen : action.type === 'staff' ? UserRound : MessageSquare; return <article className="action-card"><div className="action-card-head"><span className="action-icon"><Icon size={15} /></span><span className="action-type">{action.type}</span><span className={`action-status ${action.status}`}>{action.status}</span></div><h3>{action.title}</h3><div className="before-after"><div><span>BEFORE</span><p>{action.before}</p></div><ArrowUpRight size={14} /><div><span>AFTER</span><p>{action.after}</p></div></div><p className="action-impact"><Gauge size={13} />{action.impact}</p></article> }
function formatTraceInput(input: unknown) { if (!input || (typeof input === 'object' && Object.keys(input).length === 0)) return 'no input'; return JSON.stringify(input) }

export default App
