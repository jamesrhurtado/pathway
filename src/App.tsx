import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowUpRight, Bot, Check, ChevronRight, CircleHelp, Clock3, Crosshair, DoorOpen, Flag, Gauge, Headphones, History, LayoutGrid, Lock, MessageSquare, Play, Radio, RotateCcw, Send, ShieldCheck, Sparkles, Undo2, UserRound, Users, Wrench, X } from 'lucide-react'
import { initialEvent } from './data/demoEvent'
import { actionableIncidentIds, applyApprovedResponse, approvalMatchesRevision, approveDraftResponse, availableResources, buildAgentPacket, buildDispatchReceipts, buildHeroPacket, buildIncidentPacket, eventHealth, participantSignals, restorePreApplicationState, simulateStudioConflict, updateDraftResponse, validatePacket, validateScheduleWindow } from './lib/eventEngine'
import { registerBackstageTools } from './lib/webmcp'
import type { ActionDraft, ActivityItem, DecisionPacket, DispatchReceipt, DraftResponseUpdate, EventState, Incident, StageDecisionPacketInput } from './types'

const time = '11:18'

function focusDraftResponse() {
  window.setTimeout(() => document.getElementById('draft-response')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
}

type ToolTraceEntry = {
  id: string
  time: string
  name: string
  input: unknown
  result: unknown
  status: 'success' | 'error'
}

function App() {
  const [state, setState] = useState<EventState>(initialEvent)
  const [selectedIncidentId, setSelectedIncidentId] = useState('room-b-capacity')
  const [packet, setPacket] = useState<DecisionPacket>()
  const [activity, setActivity] = useState<ActivityItem[]>([
    { id: 'a1', time: '11:18:03', actor: 'system', label: 'Signal cluster updated', detail: '17 workshop sign-in reports grouped from participant chat', kind: 'system' },
    { id: 'a2', time: '11:17:42', actor: 'human', label: 'Incident opened', detail: 'Room B over capacity · 63 / 60', kind: 'stage' },
    { id: 'a3', time: '11:16:19', actor: 'system', label: 'Workshop heartbeat', detail: 'Agent lab is live · 12 min behind run-of-show', kind: 'read' },
  ])
  const [toast, setToast] = useState('')
  const [tools, setTools] = useState<string[]>([])
  const [webMcpSupported, setWebMcpSupported] = useState(false)
  const [toolTrace, setToolTrace] = useState<ToolTraceEntry[]>([])
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [dispatchReceipts, setDispatchReceipts] = useState<DispatchReceipt[]>([])
  const [preApplyState, setPreApplyState] = useState<EventState>()

  const selectedIncident = state.incidents.find((incident) => incident.id === selectedIncidentId) ?? state.incidents[0]
  const health = eventHealth(state)
  const validation = packet && packet.status !== 'applied' ? validatePacket(packet, state) : []
  const staleDraft = validation.some((error) => error.startsWith('Draft is stale:'))
  const studioAvailable = state.rooms.some((room) => room.name === 'Studio C' && room.status === 'available')
  const responseApplied = packet?.status === 'applied'
  const capacityIncident = state.incidents.find((incident) => incident.id === 'room-b-capacity')
  const authIncident = state.incidents.find((incident) => incident.id === 'auth-blockers')

  const log = useCallback((entry: Omit<ActivityItem, 'id' | 'time'>) => {
    setActivity((items) => [{ ...entry, id: crypto.randomUUID(), time: new Date().toLocaleTimeString('en-GB', { hour12: false }) }, ...items].slice(0, 8))
  }, [])
  const notify = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3600) }, [])
  const recordTool = useCallback((entry: { name: string; input: unknown; result: unknown; status: 'success' | 'error' }) => {
    if (toolTrace.length === 0) setDiagnosticsOpen(true)
    setToolTrace((items) => [{ id: crypto.randomUUID(), time: new Date().toLocaleTimeString('en-GB', { hour12: false }), name: entry.name, input: entry.input, result: entry.result, status: entry.status }, ...items].slice(0, 12))
  }, [toolTrace.length])

  const stageHero = useCallback(() => {
    const next = buildHeroPacket(state)
    setPacket(next)
    setDispatchReceipts([])
    setPreApplyState(undefined)
    log({ actor: 'agent', label: 'Constraint-aware draft staged', detail: `${next.revisionId} · application still locked`, kind: 'stage' })
    notify('Draft response ready for human review')
    focusDraftResponse()
  }, [log, notify, state])

  const stagePacket = useCallback((input: StageDecisionPacketInput) => {
    if (packet) return { ok: false, error: 'A decision packet already exists. Review it or reset the rehearsal before creating another.' }
    let next: DecisionPacket
    try { next = buildAgentPacket(state, input) } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Could not stage the response.', recovery: 'Re-read live state, incident evidence, and available resources, then submit a complete proposal.' } }
    const validationErrors = validatePacket(next, state)
    if (validationErrors.length) return { ok: false, error: validationErrors.join(' '), recovery: 'Re-inspect current resources and submit a valid step-free room, time, available staff member, and notice.' }
    setPacket(next)
    setDispatchReceipts([])
    log({ actor: 'agent', label: 'Draft response staged', detail: 'Three coordinated actions · application still locked', kind: 'stage' })
    focusDraftResponse()
    return { ok: true, status: 'staged', responseId: next.id, revisionId: next.revisionId, stateVersion: next.stateVersion, next: 'Call review_draft_response.' }
  }, [log, packet, state])

  const stageIncident = useCallback((incidentId: string) => {
    if (!actionableIncidentIds.includes(incidentId as (typeof actionableIncidentIds)[number])) {
      notify('This signal is monitor-only in the deterministic rehearsal')
      return
    }
    if (packet && packet.status !== 'staged') {
      notify('Reset the current packet before staging another incident response')
      return
    }
    const next = buildIncidentPacket(state, incidentId)
    setPacket(next)
    setDispatchReceipts([])
    log({ actor: 'agent', label: 'Incident response staged', detail: `${next.revisionId} · application still locked`, kind: 'stage' })
    notify(`${next.title} staged for review`)
    focusDraftResponse()
  }, [log, notify, state])

  const updateDraft = useCallback((input: DraftResponseUpdate) => {
    if (!packet || packet.status === 'applied') return { ok: false, error: 'An applied response cannot be revised.', recovery: 'Revert the applied response or reset the rehearsal first.' }
    if (!input.room && !input.start && !input.end && !input.staffId && !input.audience && !input.message) return { ok: false, error: 'No response field was changed.', recovery: 'Provide at least one room, time, staff, audience, or message change.' }
    if ((input.start || input.end) && validateScheduleWindow(input.start ?? packet.actions[0].target?.start, input.end ?? packet.actions[0].target?.end)) return { ok: false, error: validateScheduleWindow(input.start ?? packet.actions[0].target?.start, input.end ?? packet.actions[0].target?.end) }
    let next: DecisionPacket
    try { next = updateDraftResponse(packet, state, input) } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Draft update failed.' } }
    const errors = validatePacket(next, state)
    if (errors.length) return { ok: false, error: errors.join(' '), recovery: 'Re-inspect current resources and choose a valid step-free room, time, and available staff member.' }
    setPacket(next)
    log({ actor: 'agent', label: 'Draft response revised', detail: `${next.revisionId} · ${input.reason}`, kind: 'stage' })
    return { ok: true, status: 'staged', revisionId: next.revisionId, stateVersion: next.stateVersion, approval: 'required again' }
  }, [log, packet, state])

  const reviewPlan = useCallback((section = 'summary') => {
    if (!packet) return { response: null, validation: ['No staged response'], application: 'locked' }
    const validationErrors = validatePacket(packet, state)
    const application = packet.status === 'approved' && approvalMatchesRevision(packet) ? 'available' : 'locked'
    if (section === 'evidence') return { response: { id: packet.id, revisionId: packet.revisionId, stateVersion: packet.stateVersion, evidence: packet.evidence }, validation: validationErrors, application }
    if (section === 'alternatives') return { response: { id: packet.id, revisionId: packet.revisionId, stateVersion: packet.stateVersion, alternatives: packet.alternatives }, validation: validationErrors, application }
    if (section === 'actions') return { response: { id: packet.id, revisionId: packet.revisionId, stateVersion: packet.stateVersion, actions: packet.actions.map(({ id, type, title, status, incidentId, target }) => ({ id, type, title, status, incidentId, target })) }, validation: validationErrors, application }
    return {
      response: {
        id: packet.id,
        title: packet.title,
        summary: packet.summary,
        rationale: packet.rationale,
        status: packet.status,
        revisionId: packet.revisionId,
        stateVersion: packet.stateVersion,
        approval: packet.approvedRevisionId ? { approvedBy: packet.approvedBy, approvedRevisionId: packet.approvedRevisionId } : 'required',
        selectedAlternative: packet.alternatives.find((alternative) => alternative.decision === 'selected')?.label,
        constraints: packet.constraints,
        actions: packet.actions.map(({ type, status, incidentId, target }) => ({ type, status, incidentId, target })),
      },
      validation: validationErrors,
      application,
    }
  }, [packet, state])

  const applyResponse = useCallback(() => {
    if (!packet || !approvalMatchesRevision(packet)) return { ok: false, error: 'Human approval for the exact current revision is required.' }
    const currentValidation = validatePacket(packet, state)
    if (currentValidation.length) return { ok: false, error: `Approved response is stale: ${currentValidation.join(' ')}`, recovery: 'Re-inspect resources, update the draft, and request fresh approval.' }
    const receipts = buildDispatchReceipts(packet)
    setPreApplyState(state)
    setState((current) => applyApprovedResponse(current, packet))
    setDispatchReceipts(receipts)
    setPacket((current) => current ? { ...current, status: 'applied', appliedAt: time } : current)
    log({ actor: 'human', label: 'Exact approved revision applied', detail: `${packet.revisionId} · three demo destinations updated`, kind: 'apply' })
    notify('Approved response applied to the demo event board')
    return { ok: true, status: 'applied-to-demo', responseRevision: packet.revisionId, stateVersion: state.version + 1, receipts, undoAvailable: true }
  }, [log, notify, packet, state])

  const revertResponse = useCallback(() => {
    if (!packet || packet.status !== 'applied' || !preApplyState) return { ok: false, error: 'No applied response is available to revert.' }
    // Restore the exact payload while keeping the event revision monotonic.
    const revertedState = restorePreApplicationState(state, preApplyState)
    const reverted = updateDraftResponse({ ...packet, status: 'staged' }, revertedState, { reason: 'Applied demo response was reverted to its exact prior state.' })
    setState(revertedState)
    setPacket(reverted)
    setDispatchReceipts([])
    setPreApplyState(undefined)
    log({ actor: 'human', label: 'Applied response reverted', detail: `${packet.revisionId} rolled back · fresh approval required`, kind: 'rollback' })
    notify('Demo state restored; the response requires fresh approval')
    return { ok: true, status: 'reverted', revertedRevision: packet.revisionId, nextRevision: reverted.revisionId, stateVersion: revertedState.version }
  }, [log, notify, packet, preApplyState, state.version])

  const bridge = useMemo(() => ({ state, stagedPlan: packet, approved: packet?.status === 'approved' && approvalMatchesRevision(packet), canUndo: Boolean(preApplyState), stagePacket, updateDraft, reviewPlan, applyResponse, revertResponse, recordTool }), [applyResponse, packet, preApplyState, recordTool, revertResponse, reviewPlan, stagePacket, state, updateDraft])
  useEffect(() => {
    const result = registerBackstageTools(bridge)
    setWebMcpSupported(result.supported)
    setTools(result.names)
    return result.cleanup
  }, [bridge])

  const approve = () => {
    if (!packet || validation.length) return
    const approved = approveDraftResponse(packet, 'You · event lead')
    setPacket(approved)
    log({ actor: 'human', label: 'Exact draft revision approved', detail: `${approved.revisionId} · apply capability unlocked`, kind: 'approval' })
    notify(`Approved ${approved.revisionId} — apply is now available`)
  }
  const injectConflict = () => {
    if (!packet || packet.status === 'applied') { notify('Stage a response before injecting the room conflict'); return }
    setState((current) => simulateStudioConflict(current))
    setPacket((current) => current ? { ...current, status: 'staged', approvedBy: undefined, approvedRevisionId: undefined } : current)
    log({ actor: 'system', label: 'Live resource conflict', detail: 'Studio C was claimed early · draft is now stale', kind: 'system' })
    notify('Studio C changed live — approval invalidated and re-planning required')
  }
  const replanToAtrium = () => {
    const result = updateDraft({ room: 'Atrium Annex', start: '11:30', end: '11:55', staffId: 'ines', reason: 'Studio C was claimed early; Atrium Annex is the remaining step-free room with enough capacity, and Inés remains available after Luis’s 11:50 handoff.' })
    if (result.ok) notify('Draft re-planned to Atrium Annex; fresh approval is required')
    else notify(result.error ?? 'Re-plan failed')
  }
  const reset = () => { setState(initialEvent); setPacket(undefined); setSelectedIncidentId('room-b-capacity'); setDispatchReceipts([]); setPreApplyState(undefined); setTools([]); setToolTrace([]); setDiagnosticsOpen(false); notify('Demo state reset') }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to event operations</a>
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Crosshair size={16} /></span><span>BACKSTAGE</span><span className="brand-slash">/</span><span className="brand-sub">OPERATIONS DESK</span></div>
      <div className="topbar-event"><span className="live-dot" />LIVE <span className="mono">{time}</span><span className="topbar-divider" />{state.event.title}<span className="muted">· {state.event.location}</span></div>
      <div className="topbar-actions"><span className={`webmcp-status ${webMcpSupported ? 'is-live' : ''}`}><span className="status-dot" />WebMCP {webMcpSupported ? 'connected' : 'preview'}</span><button className="icon-button" onClick={reset} aria-label="Reset demo"><RotateCcw size={16} /></button><div className="avatar">JM</div></div>
    </header>

    <main className="main-wrap" id="main-content">
      <section className="hero-grid">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" />OPERATOR CONSOLE · DEMO DATA <span className="mono">/ {state.event.date}</span></div><h1>Recover a live event<br /><em>without losing human control.</em></h1><p>Backstage lets a browser agent reconcile incidents, accessibility needs, room turnover, staff availability, and a fixed schedule into one reviewable response. Nothing changes until the organizer approves the exact current revision.</p><div className="hero-command"><div className="command-icon"><Bot size={18} /></div><div className="command-text"><span className="command-label">ASK YOUR BROWSER AGENT · STOP BEFORE APPLYING</span><span>“Resolve the three-seat overflow and 17 sign-in blockers. One attendee needs a step-free route. Keep the 12:00 end time and respect Studio C’s 11:50 rehearsal. Draft the least disruptive response, but do not apply it.”</span></div>{!webMcpSupported && <button className="ghost-button hero-fallback" onClick={stageHero} disabled={Boolean(packet)}><Play size={15} /> {packet ? 'Response already staged' : 'Preview without agent'}</button>}</div></div>
        <div className="hero-aside"><div className="health-ring"><div className="health-number">{health}</div><div className="health-label">/ 100<br /><span>event health</span></div></div><div className="aside-copy"><span className="eyebrow">OPS READ</span><strong>{responseApplied ? 'Approved response active' : staleDraft ? 'Re-planning required' : health > 80 ? 'Stable with an active edge' : 'Needs operator attention'}</strong><span>{responseApplied ? `Revision ${packet?.revisionId} is active in the in-app rehearsal.` : staleDraft ? `The current draft is stale against event state v${state.version}.` : 'One critical incident needs a coordinated response; no change has been applied.'}</span></div><div className="hero-aside-footer"><span><Radio size={14} /> {state.sessions.filter((item) => item.status === 'live').length} room live</span><span><Clock3 size={14} /> next handoff 11:25</span></div></div>
      </section>

      <section className="demo-explainer panel" aria-label="How this rehearsal works"><div className="demo-explainer-copy"><span className="eyebrow">WHO DOES WHAT</span><strong>The agent investigates and drafts. The organizer decides and applies.</strong><span>This is one organizer console using fictional data. Applying updates three simulated in-app destinations: the room board, a staff briefing view, and an attendee notice preview. It does not send email, Slack, or a real notification.</span></div><div className="demo-steps"><span><b>AGENT 01</b> Read evidence</span><span><b>AGENT 02</b> Draft response</span><span><b>HUMAN 03</b> Review + approve</span><span><b>HUMAN 04</b> Apply to demo</span></div></section>

      <section className="metric-strip" aria-label="Event metrics"><Metric label="LIVE SOURCES" value="4" delta="state surfaces" icon={<Bot size={15} />} /><Metric label="SESSIONS" value={`${state.sessions.filter((item) => item.status === 'live').length} / ${state.sessions.length}`} delta="1 in motion" icon={<LayoutGrid size={15} />} /><Metric label="ACTIVE INCIDENTS" value={String(state.incidents.filter((item) => item.status !== 'resolved').length)} delta={responseApplied ? 'response active' : '1 critical'} tone={responseApplied ? '' : 'critical'} icon={<AlertTriangle size={15} />} /><Metric label="AGENT TOOLS" value={String(tools.length || 4)} delta={webMcpSupported ? 'state-aware now' : 'ready to register'} icon={<Wrench size={15} />} /></section>

      <section className="workbench-grid">
        <div className="pulse-rail panel"><PanelHeading icon={<Activity size={15} />} title="Live pulse" meta="chronological signal" /><div className="timeline"><TimelineItem time="11:18" tone={capacityIncident?.status === 'monitoring' ? 'positive' : 'critical'} title="Room B over capacity" detail={capacityIncident?.status === 'monitoring' ? 'Response active · overflow route staged' : '63 checked in · 60 seats · 3 standing'} badge={capacityIncident?.status === 'monitoring' ? 'HANDLED' : 'CRITICAL'} /><TimelineItem time="11:16" tone={authIncident?.status === 'monitoring' ? 'positive' : 'warning'} title="Sign-in reports clustering" detail={authIncident?.status === 'monitoring' ? 'Support assigned · response active' : '17 participant signals · +9 in 8 min'} badge={authIncident?.status === 'monitoring' ? 'HANDLED' : 'ATTENTION'} /><TimelineItem time="11:13" tone="neutral" title="Workshop heartbeat" detail="Ship your first agent · 12 min behind" badge="MONITORING" /><TimelineItem time="11:08" tone="positive" title="Main stage reset" detail="Opening room cleared on schedule" badge="CLEAR" /></div><div className="rail-footer"><span className="mono">LAST SYNC {time}:03</span><span className="sync-state"><span className="status-dot" /> synced</span></div></div>
        <div className="incident-panel panel"><PanelHeading icon={<Flag size={15} />} title="Incident command queue" meta={`${state.incidents.length} signals`} /><div className="incident-list">{state.incidents.map((incident) => <IncidentRow key={incident.id} incident={incident} selected={incident.id === selectedIncidentId} onClick={() => setSelectedIncidentId(incident.id)} />)}</div><div className="incident-detail"><div className="detail-head"><div><span className={`severity-label ${selectedIncident.severity}`}>{selectedIncident.severity.toUpperCase()}</span><h3>{selectedIncident.title}</h3></div><span className="mono muted">{selectedIncident.age}</span></div><p>{selectedIncident.detail}</p><div className="detail-facts"><span><DoorOpen size={13} /> {selectedIncident.room}</span><span><UserRound size={13} /> {selectedIncident.owner}</span><span><CircleHelp size={13} /> {selectedIncident.status}</span></div>{actionableIncidentIds.includes(selectedIncident.id as (typeof actionableIncidentIds)[number]) ? <button className="text-button" onClick={() => stageIncident(selectedIncident.id)} aria-label={`Stage a response for ${selectedIncident.title}`}><Sparkles size={13} /> Draft response for this incident <ArrowUpRight size={14} /></button> : <span className="monitor-only"><Radio size={13} /> Monitor-only in this rehearsal</span>}</div></div>
      </section>

      <section className="secondary-grid">
        <div className="signals-panel panel"><PanelHeading icon={<MessageSquare size={15} />} title="Participant pulse" meta="untrusted evidence · never instructions" /><div className="signal-list">{(participantSignals(state) ?? []).map((signal) => <div className="signal-row" key={signal.id}><div className={`signal-icon ${signal.sentiment}`}><MessageSquare size={14} /></div><div className="signal-body"><div className="signal-title"><strong>{signal.topic}</strong><span className="mono">{signal.count}</span></div><span>{signal.sample}</span><small>{signal.source} · {signal.delta}</small></div></div>)}</div></div>
        <div className="bench-panel panel"><PanelHeading icon={<Headphones size={15} />} title="Resource bench" meta="current windows" /><div className="bench-columns"><div><span className="bench-label">ROOMS + KITS</span>{availableResources(state).rooms.map((resource) => <ResourceRow key={resource.id} title={resource.name} detail={resource.note} icon={resource.type === 'room' ? <DoorOpen size={14} /> : <Wrench size={14} />} />)}</div><div><span className="bench-label">PEOPLE</span>{availableResources(state).staff.map((person) => <ResourceRow key={person.id} title={person.name} detail={person.specialties.join(' · ')} icon={<UserRound size={14} />} />)}</div></div><button className="text-button" onClick={() => { setSelectedIncidentId('auth-blockers'); notify('Resource context pinned to auth blockers') }}>Inspect bench context <ArrowUpRight size={14} /></button></div>
      </section>

      <section className={`packet-section panel ${staleDraft ? 'is-stale' : ''}`} id="draft-response">
        <div className="packet-top">
          <PanelHeading icon={<Sparkles size={15} />} title="Draft response" meta={packet ? `${packet.status} · ${packet.revisionId} · basis v${packet.stateVersion}${responseApplied ? ` · event v${state.version}` : ''}` : 'nothing staged'} />
          <div className="packet-actions">
            <span className="fixed-constraint"><Lock size={14} /> 12:00 + step-free fixed</span>
            {packet && packet.status !== 'applied' && studioAvailable && <button className="ghost-button" onClick={injectConflict}><AlertTriangle size={14} /> Inject live conflict</button>}
            {packet?.status === 'staged' && <button className="primary-button small" onClick={approve} disabled={validation.length > 0}><Check size={14} /> Approve exact revision</button>}
            {packet?.status === 'approved' && <button className="apply-button" onClick={() => applyResponse()}><Send size={14} /> Apply approved response</button>}
            {packet?.status === 'applied' && <span className="applied-pill"><Check size={12} /> applied</span>}
          </div>
        </div>
        {packet ? <>
          {staleDraft && <div className="conflict-rail"><div><AlertTriangle size={16} /><span><strong>Live state changed after this draft.</strong> Studio C was claimed early, so approval is locked until the response is re-planned against event state v{state.version}.</span></div>{!webMcpSupported && <button className="ghost-button" onClick={replanToAtrium}><RotateCcw size={14} /> Re-plan to Atrium Annex</button>}</div>}
          <div className="packet-intro"><div><h2>{packet.title}</h2><p>{packet.summary}</p><div className="packet-rationale"><span className="eyebrow">AGENT RATIONALE</span><p>{packet.rationale ?? packet.summary}</p></div><div className="packet-mode-note"><Lock size={12} /> Approval is bound to {packet.revisionId}. Any edit or live-state conflict invalidates it.</div></div><div className="constraint-stack">{packet.constraints.map((constraint) => <span className="constraint locked" key={constraint}><Lock size={11} /> {constraint}</span>)}</div></div>
          <div className="packet-proof-grid"><div className="proof-panel"><div className="proof-heading"><ShieldCheck size={14} /><span>Evidence used</span><span className="mono">{packet.evidence.length} sources</span></div>{packet.evidence.map((item) => <div className="proof-row" key={item.id}><span className={`proof-trust ${item.trust}`}>{item.trust === 'trusted' ? 'TRUSTED' : 'UNTRUSTED'}</span><div><strong>{item.label}</strong><span>{item.detail}</span><small>{item.source} · observed {item.observedAt}</small></div></div>)}</div><div className="proof-panel"><div className="proof-heading"><ArrowUpRight size={14} /><span>Alternatives considered</span><span className="mono">least disruption</span></div>{packet.alternatives.map((alternative) => <div className={`alternative-row ${alternative.decision}`} key={alternative.id}><span className="alternative-mark">{alternative.decision === 'selected' ? '✓' : '×'}</span><div><strong>{alternative.label}</strong><span>{alternative.outcome}</span><small>{alternative.disruption}</small></div><span className="alternative-decision">{alternative.decision}</span></div>)}</div></div>
          <div className="impact-strip"><Metric label="SIGN-IN REPORTS" value={String(packet.metrics.signInReports)} delta="untrusted evidence" icon={<Users size={15} />} /><Metric label="SEATS RECOVERED" value={String(packet.metrics.seatShortfallResolved)} delta="derived from 63 / 60" icon={<Gauge size={15} />} /><Metric label="COORDINATED" value={String(packet.metrics.coordinatedActions)} delta="atomic demo update" icon={<LayoutGrid size={15} />} /><Metric label="CONSTRAINTS" value={String(packet.metrics.constraintChecks)} delta="validated live" icon={<ShieldCheck size={15} />} /></div>
          <div className="action-grid">{packet.actions.map((action) => <ActionCard key={action.id} action={action} />)}</div>
          {validation.length > 0 && <div className="validation-warning"><AlertTriangle size={14} /><span>{validation.join(' ')}</span></div>}
        </> : <div className="empty-packet"><div className="empty-icon"><Bot size={20} /></div><div><strong>No draft response yet</strong><span>Ask a browser agent to investigate and draft. The preview button demonstrates the same shared page state without a connected agent.</span></div><span className="packet-lock"><Lock size={14} /> apply unavailable</span></div>}
      </section>

      {dispatchReceipts.length > 0 && <section className="dispatch-section panel" aria-label="Applied response destinations"><div className="dispatch-head"><div><span className="eyebrow">APPLIED RESPONSE · DEMO ONLY</span><h2>One exact revision, three in-app receipts</h2><p>These receipt previews show the room board, staff briefing view, and attendee notice preview updated together. No external system was contacted.</p></div><div className="dispatch-actions"><span className="dispatch-status"><Check size={14} /> applied together</span><button className="ghost-button undo-button" onClick={() => revertResponse()}><Undo2 size={14} /> Revert response</button></div></div><div className="dispatch-grid">{dispatchReceipts.map((receipt) => <DispatchCard key={receipt.id} receipt={receipt} />)}</div></section>}

        <details className="diagnostics-disclosure" open={diagnosticsOpen} onToggle={(event) => setDiagnosticsOpen(event.currentTarget.open)}>
        <summary><span><Wrench size={15} /> Agent diagnostics</span><small>Tool lifecycle, activity history, and flight recorder</small><ChevronRight size={15} /></summary>
        <section className="bottom-grid"><div className="activity-panel panel"><PanelHeading icon={<History size={15} />} title="Activity history" meta="human + agent" /><div className="activity-list">{activity.map((item) => <div className="activity-row" key={item.id}><span className={`activity-dot ${item.kind}`} /><span className="mono activity-time">{item.time}</span><div><strong>{item.label}</strong><span>{item.detail}</span></div><span className={`actor-tag ${item.actor}`}>{item.actor}</span></div>)}</div></div><div className="tool-panel panel"><PanelHeading icon={<Wrench size={15} />} title="WebMCP tool map" meta={webMcpSupported ? 'live registration' : 'browser preview'} /><div className="tool-list">{(tools.length ? tools : ['get_live_event_state', 'inspect_incident', 'inspect_participant_signals', 'find_available_resources', 'stage_decision_packet']).map((tool) => <div className="tool-row" key={tool}><span className="tool-state" /><code>{tool}</code><span className="tool-kind">{['stage_', 'update_', 'apply_', 'revert_'].some((prefix) => tool.startsWith(prefix)) ? 'WRITE' : 'READ'}</span></div>)}</div><div className="tool-note"><ShieldCheck size={14} /> Tools change with state; apply exists only for an approved exact revision.</div></div><div className="flight-panel panel"><PanelHeading icon={<Radio size={15} />} title="Agent flight recorder" meta={`${toolTrace.length} calls captured`} /><div className="trace-list">{toolTrace.length ? toolTrace.map((entry) => <div className="trace-row" key={entry.id}><span className={`trace-dot ${entry.status}`} /><span className="mono trace-time">{entry.time}</span><div className="trace-detail"><code>{entry.name}</code><span>{entry.status === 'success' ? 'completed' : 'rejected'} · {formatTraceInput(entry.input)}</span><details className="trace-output"><summary>{entry.status === 'success' ? 'inspect output' : 'inspect error + recovery'}</summary><pre>{formatTraceResult(entry.result)}</pre></details></div></div>) : <div className="trace-empty"><Bot size={15} /><span>Ask a browser agent to run the scenario. Tool inputs, outcomes, and rejected attempts will appear here.</span></div>}</div><div className="tool-note"><ShieldCheck size={14} /> Every call is bounded, visible, and tied to the page’s current state.</div></div></section>
      </details>
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
function DispatchCard({ receipt }: { receipt: DispatchReceipt }) { const Icon = receipt.kind === 'room-board' ? DoorOpen : receipt.kind === 'staff-brief' ? UserRound : MessageSquare; return <article className="dispatch-card"><div className="dispatch-card-head"><span className="dispatch-icon"><Icon size={15} /></span><div><strong>{receipt.destination}</strong><span>{receipt.audience.replace('-', ' ')}</span></div><span className="receipt-state"><Check size={11} /> APPLIED</span></div><p>{receipt.summary}</p><small>{receipt.responseRevision} · {receipt.delivery} · no external send</small></article> }
function formatTraceInput(input: unknown) { if (!input || (typeof input === 'object' && Object.keys(input).length === 0)) return 'no input'; return JSON.stringify(input) }
function formatTraceResult(result: unknown) { const text = typeof result === 'string' ? result : JSON.stringify(result); return text.length > 520 ? `${text.slice(0, 520)}…` : text }

export default App
