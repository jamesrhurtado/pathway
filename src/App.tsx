import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, Bot, CalendarDays, Check, ChevronDown, CircleAlert, Clock3, DollarSign, ExternalLink, GitCompareArrows, Languages, LockKeyhole, Map, RefreshCcw, Search, ShieldCheck, Sparkles, Target, WandSparkles, X } from 'lucide-react'
import { defaultGoal, getLearningTemplate, learningCatalog } from './data/catalog'
import { approveRoadmap, compareLearningOptions, replaceRoadmapOption, replanRemainingSchedule, reviseRoadmap, roadmapSummary, saveApprovedRoadmap, updateLearningProgress, buildRoadmap, searchLearningOptions } from './lib/pathwayEngine'
import { registerPathwayTools } from './lib/webmcp'
import type { LearningDomain, LearningGoal, LearningOption, PathwayState, RoadmapRevisionInput, ToolTraceEntry } from './types'

const emptyGoal: LearningGoal = {
  ...defaultGoal,
  topic: '',
  outcome: '',
  knownSkills: [],
  weeks: 8,
  hoursPerWeek: 5,
  budgetUsd: 100,
}

const judgeExample = {
  brief: 'I manage social media for my family’s café and want to start taking paid food photography work for local restaurants.',
  goal: {
    ...defaultGoal,
    topic: '',
    outcome: 'Create a client-ready food photography portfolio and a one-page brief I can show local restaurants.',
    knownSkills: ['Basic photo editing', 'Social media content'],
    weeks: 8,
    hoursPerWeek: 5,
    budgetUsd: 100,
    language: 'Spanish',
    asyncOnly: true,
    preferredFormat: 'any' as const,
  },
}

const freshState = (): PathwayState => ({ version: 1, goal: { ...emptyGoal, knownSkills: [] }, catalog: learningCatalog })
const writeTools = new Set(['prepare_learning_search', 'build_learning_path', 'revise_learning_path', 'update_learning_progress', 'replan_remaining_path'])

function inferDemoCoverage(brief: string): LearningDomain | undefined {
  const text = brief.toLowerCase()
  if (/(photo|photograph|camera|portrait|food|product|visual)/.test(text)) return 'photography'
  if (/(workshop|facilitat|teach|training|lesson|community)/.test(text)) return 'facilitation'
  if (/(kubernetes|k8s|node|container|deploy)/.test(text)) return 'kubernetes'
  return undefined
}

function searchQueryFor(templateId: LearningDomain) {
  return templateId === 'photography' ? 'food photography lighting editing portfolio' : templateId === 'facilitation' ? 'learning design inclusive activity workshop' : 'kubernetes workload services node deployment'
}

function initialState(): PathwayState {
  if (typeof localStorage === 'undefined') return freshState()
  try {
    const stored = JSON.parse(localStorage.getItem('pathway-roadmap') ?? 'null')
    if (stored?.status === 'saved' && stored?.goal?.templateId && stored?.schedule?.weeks && Array.isArray(stored?.steps)) {
      const storedProgress = JSON.parse(localStorage.getItem('pathway-progress') ?? 'null')
      const progress = storedProgress?.roadmapId === stored.id && Array.isArray(storedProgress?.completedStepIds) ? storedProgress : undefined
      return { version: Number(stored.stateVersion) || 1, goal: stored.goal, catalog: learningCatalog, roadmap: stored, progress }
    }
  } catch { /* Invalid earlier demo storage is cleared below. */ }
  localStorage.removeItem('pathway-roadmap')
  localStorage.removeItem('pathway-progress')
  return freshState()
}

function formatMoney(value: number) {
  return value === 0 ? 'Free' : `$${value}`
}

function kindLabel(kind: string) {
  return kind === 'produce' ? 'Produce proof' : kind === 'practice' ? 'Practice' : 'Learn'
}

function JourneyStrip({ active }: { active: 1 | 2 | 3 | 4 }) {
  const steps = ['Describe', 'Review sources', 'Build path', 'Approve']
  return <nav className="journey-strip" aria-label="Pathway workflow"><ol>{steps.map((step, index) => {
    const number = index + 1
    const complete = number < active
    return <li className={number === active ? 'is-active' : complete ? 'is-complete' : ''} key={step}><span>{complete ? <Check size={12} /> : number}</span><strong>{step}</strong></li>
  })}</ol></nav>
}

function App() {
  const [state, setState] = useState<PathwayState>(initialState)
  const [formGoal, setFormGoal] = useState<LearningGoal>(() => state.goal)
  const [brief, setBrief] = useState('')
  const [skillsText, setSkillsText] = useState(() => state.goal.knownSkills.join(', '))
  const [webMcpSupported, setWebMcpSupported] = useState(false)
  const [tools, setTools] = useState<string[]>([])
  const [toolTrace, setToolTrace] = useState<ToolTraceEntry[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<string>()
  const [selectedStepId, setSelectedStepId] = useState<string>()
  const [comparisonIds, setComparisonIds] = useState<string[]>([])
  const [revisionReason, setRevisionReason] = useState('The learner needs a different fit.')
  const [toast, setToast] = useState('')
  const detailsDialog = useRef<HTMLDialogElement>(null)
  const comparisonDialog = useRef<HTMLDialogElement>(null)

  const roadmap = state.roadmap
  const discovery = state.discovery
  const discoveryResults = discovery ? discovery.resultIds.map((id) => state.catalog.find((item) => item.id === id)).filter((item): item is LearningOption => Boolean(item)) : []
  const selectedOption = state.catalog.find((option) => option.id === selectedOptionId)
  const selectedStep = roadmap?.steps.find((step) => step.id === selectedStepId)
  const comparison = comparisonIds.length >= 2 ? compareLearningOptions(state.catalog, comparisonIds, roadmap?.goal ?? state.goal) : []
  const completedStepIds = state.progress?.roadmapId === roadmap?.id ? (state.progress?.completedStepIds ?? []) : []
  const completedSet = new Set(completedStepIds)
  const completedCount = completedStepIds.length
  const nextIncompleteStep = roadmap?.steps.find((step) => !completedSet.has(step.id))
  const progressPercent = roadmap?.steps.length ? Math.round((completedCount / roadmap.steps.length) * 100) : 0
  const canReplan = Boolean(roadmap?.status === 'saved' && completedCount > 0 && completedCount < roadmap.steps.length)
  const journeyStage: 1 | 2 | 3 | 4 = roadmap ? (roadmap.status === 'draft' ? 3 : 4) : discovery ? 2 : 1

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }, [])

  const recordTool = useCallback((entry: Omit<ToolTraceEntry, 'id' | 'time'>) => {
    setToolTrace((items) => [{ ...entry, id: crypto.randomUUID(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...items].slice(0, 12))
  }, [])

  const prepareDiscovery = useCallback((input: Omit<LearningGoal, 'templateId'> & { templateId?: LearningDomain; brief: string }) => {
    try {
      const templateId = input.templateId || inferDemoCoverage(input.brief)
      const selectedTemplate = templateId && getLearningTemplate(templateId)
      if (!selectedTemplate) throw new Error('This demo catalog does not yet cover that subject. Try a commercial photography or workshop facilitation goal.')
      const goal: LearningGoal = {
        ...input,
        templateId: templateId!,
        topic: selectedTemplate.topic,
        outcome: input.outcome.trim() || selectedTemplate.defaultOutcome,
        knownSkills: [...input.knownSkills],
      }
      const query = searchQueryFor(templateId)
      const searchLimits = { domain: templateId, language: goal.language, freeOnly: goal.freeOnly, asyncOnly: goal.asyncOnly, budgetUsd: goal.budgetUsd, maxHours: goal.weeks * goal.hoursPerWeek }
      const primaryResults = searchLearningOptions(state.catalog, query, { ...searchLimits, format: goal.preferredFormat, limit: 8 })
      const coverageResults = selectedTemplate.stages.map((stage) => {
        const preferred = searchLearningOptions(state.catalog, stage.competency, { ...searchLimits, format: goal.preferredFormat, limit: 1 })[0]
        return preferred ?? searchLearningOptions(state.catalog, stage.competency, { ...searchLimits, limit: 1 })[0]
      }).filter((item): item is LearningOption => Boolean(item))
      const results = [...coverageResults, ...primaryResults].filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index).slice(0, 8)
      if (!results.length) throw new Error('No catalog resources fit every filter. Relax a format, language, or free-only filter and search again.')
      const discovery = { brief: input.brief.trim(), query, templateId, resultIds: results.map((item) => item.id), updatedAt: new Date().toISOString() }
      setState((current) => ({ ...current, goal, discovery, roadmap: undefined, progress: undefined }))
      setFormGoal(goal)
      setSkillsText(goal.knownSkills.join(', '))
      setBrief(input.brief)
      setComparisonIds([])
      notify(`${results.length} resources found for review`)
      window.setTimeout(() => document.getElementById('search-results')?.focus(), 0)
      return { ok: true, interpretation: { query, templateCoverage: selectedTemplate.name, filters: { language: goal.language, budgetUsd: goal.budgetUsd, freeOnly: goal.freeOnly, asyncOnly: goal.asyncOnly, preferredFormat: goal.preferredFormat, knownSkills: goal.knownSkills, planCapacity: `${goal.weeks} weeks at ${goal.hoursPerWeek} hours per week` } }, results: results.map(({ id, title, provider, format, languages, durationHours, priceUsd }) => ({ id, title, provider, format, languages, durationHours, priceUsd })), next: 'Review visible resources, then build a draft path. Human approval is still required later.' }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Could not prepare the search.', recovery: 'Describe a covered goal and check the selected filters.' }
    }
  }, [notify, state.catalog])

  const build = useCallback((input: LearningGoal, reviewedResourceIds?: string[], preferredResourceIds: string[] = []) => {
    try {
      const selectedTemplate = getLearningTemplate(input.templateId)
      if (!selectedTemplate) throw new Error('Choose a supported learning path.')
      const goal = { ...input, topic: input.topic.trim() || selectedTemplate.topic, knownSkills: [...input.knownSkills] }
      const reviewed = reviewedResourceIds ?? state.discovery?.resultIds ?? []
      if (!reviewed.length) throw new Error('Review at least one visible resource before building a path.')
      const unknown = reviewed.filter((id) => !state.catalog.some((option) => option.id === id))
      if (unknown.length) throw new Error(`The reviewed resource ${unknown[0]} is not in the current catalog.`)
      const candidateIds = [...new Set(reviewed)]
      const preferred = preferredResourceIds.filter((id) => candidateIds.includes(id))
      const next = buildRoadmap(goal, state.catalog, state.version, 1, candidateIds, preferred)
      localStorage.removeItem('pathway-progress')
      setState((current) => ({ ...current, goal, roadmap: next, progress: undefined }))
      setFormGoal(goal)
      setSkillsText(goal.knownSkills.join(', '))
      notify('Your draft path is ready to review')
      window.setTimeout(() => document.getElementById('roadmap')?.focus(), 0)
      return { ok: true, ...roadmapSummary(next, state.catalog), humanApproval: 'required before a person can save this path' }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Could not build the learning path.', recovery: 'Use a supported path and check the constraints.' }
    }
  }, [notify, state.catalog, state.discovery?.resultIds, state.version])

  const revise = useCallback((input: RoadmapRevisionInput) => {
    if (!state.roadmap) return { ok: false, error: 'No learning path exists.', recovery: 'Build a learning path first.' }
    try {
      const nextVersion = state.version + 1
      const next = reviseRoadmap(state.roadmap, { ...state, version: nextVersion }, input)
      setState((current) => ({ ...current, version: nextVersion, goal: next.goal, roadmap: next, discovery: undefined }))
      setFormGoal(next.goal)
      setSkillsText(next.goal.knownSkills.join(', '))
      notify(`Path revised · ${next.revisionId}`)
      return { ok: true, reason: input.reason, ...roadmapSummary(next, state.catalog), humanApproval: 'required again' }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Could not revise the learning path.', recovery: 'Read the current context and give a valid learner constraint.' }
    }
  }, [notify, state])

  const replaceOption = useCallback((stepId: string, optionId: string) => {
    if (!state.roadmap) return
    try {
      const nextVersion = state.version + 1
      const next = replaceRoadmapOption(state.roadmap, state.catalog, stepId, optionId, nextVersion)
      setState((current) => ({ ...current, version: nextVersion, roadmap: next }))
      comparisonDialog.current?.close()
      notify('Resource selected; review the updated draft')
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not select this resource') }
  }, [notify, state])

  const updateProgress = useCallback((ids: string[]) => {
    if (!state.roadmap) return { ok: false, error: 'No learning path exists.', recovery: 'Build and save a learning path first.' }
    try {
      const progress = updateLearningProgress(state.roadmap, state.progress, ids)
      setState((current) => ({ ...current, progress }))
      localStorage.setItem('pathway-progress', JSON.stringify(progress))
      return { ok: true, completedStepIds: progress.completedStepIds, remainingSteps: state.roadmap.steps.filter((step) => !progress.completedStepIds.includes(step.id)).map((step) => ({ id: step.id, competency: step.competency })), storage: 'this browser only' }
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Could not update progress.', recovery: 'Use an ordered prefix of the visible step ids.' } }
  }, [state])

  const replan = useCallback(() => {
    if (!state.roadmap) return { ok: false, error: 'No learning path exists.', recovery: 'Build and save a learning path first.' }
    try {
      const nextVersion = state.version + 1
      const next = replanRemainingSchedule(state.roadmap, state.progress, state.catalog, nextVersion)
      setState((current) => ({ ...current, version: nextVersion, roadmap: next }))
      notify('Only the unfinished weeks were replanned')
      return { ok: true, ...roadmapSummary(next, state.catalog), humanApproval: 'required again before saving this revision' }
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Could not replan unfinished work.', recovery: 'Complete at least one step and keep enough remaining time.' } }
  }, [notify, state])

  const submitGoal = (event: React.FormEvent) => {
    event.preventDefault()
    const inferred = inferDemoCoverage(brief)
    const result = prepareDiscovery({ ...formGoal, templateId: inferred, brief, knownSkills: skillsText.split(',').map((skill) => skill.trim()).filter(Boolean) })
    if (!result.ok) notify(result.error ?? 'Could not prepare the search')
  }

  const submitRevision = (event: React.FormEvent) => {
    event.preventDefault()
    const result = revise({
      knownSkills: skillsText.split(',').map((skill) => skill.trim()).filter(Boolean),
      weeks: formGoal.weeks,
      hoursPerWeek: formGoal.hoursPerWeek,
      budgetUsd: formGoal.budgetUsd,
      language: formGoal.language,
      freeOnly: formGoal.freeOnly,
      asyncOnly: formGoal.asyncOnly,
      preferredFormat: formGoal.preferredFormat,
      reason: revisionReason,
    })
    if (!result.ok) notify(result.error ?? 'Could not revise the learning path')
  }

  const approve = () => {
    if (!roadmap) return
    try {
      const approved = approveRoadmap(roadmap)
      setState((current) => ({ ...current, roadmap: approved }))
      notify('You approved this exact path')
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not approve this path') }
  }

  const save = () => {
    if (!roadmap) return
    try {
      const saved = saveApprovedRoadmap(roadmap)
      setState((current) => ({ ...current, roadmap: saved }))
      localStorage.setItem('pathway-roadmap', JSON.stringify(saved))
      notify('Saved in this browser')
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not save this path') }
  }

  const toggleProgress = (stepId: string) => {
    const index = roadmap?.steps.findIndex((step) => step.id === stepId) ?? -1
    const next = completedSet.has(stepId) ? completedStepIds.slice(0, index) : [...completedStepIds, stepId]
    const result = updateProgress(next)
    notify(result.ok ? (completedSet.has(stepId) ? 'Progress reset from this step' : 'Step marked complete') : (result.error ?? 'Could not update progress'))
  }

  const resetDemo = () => {
    localStorage.removeItem('pathway-roadmap')
    localStorage.removeItem('pathway-progress')
    detailsDialog.current?.close()
    comparisonDialog.current?.close()
    const fresh = freshState()
    setState(fresh)
    setFormGoal(fresh.goal)
    setBrief('')
    setSkillsText('')
    setToolTrace([])
    setComparisonIds([])
    setRevisionReason('The learner needs a different fit.')
    notify('Cleared. Start with any covered learning goal.')
  }

  const loadJudgeExample = () => {
    const goal = { ...judgeExample.goal, knownSkills: [...judgeExample.goal.knownSkills] }
    setState({ version: 1, goal, catalog: learningCatalog })
    setFormGoal(goal)
    setBrief(judgeExample.brief)
    setSkillsText(goal.knownSkills.join(', '))
    setToolTrace([])
    notify('Example loaded for editing — no search has run yet')
    window.setTimeout(() => document.getElementById('learning-goal')?.focus(), 0)
  }

  const openDetails = (optionId: string, stepId: string) => {
    setSelectedOptionId(optionId)
    setSelectedStepId(stepId)
    window.setTimeout(() => { if (detailsDialog.current && !detailsDialog.current.open) detailsDialog.current.showModal() }, 0)
  }

  const openComparison = (stepId: string) => {
    const step = roadmap?.steps.find((item) => item.id === stepId)
    if (!step) return
    setSelectedStepId(stepId)
    setComparisonIds([step.optionId, ...step.alternativeIds].slice(0, 3))
    window.setTimeout(() => { if (comparisonDialog.current && !comparisonDialog.current.open) comparisonDialog.current.showModal() }, 0)
  }

  const toggleDiscoveryComparison = (optionId: string) => {
    setComparisonIds((current) => current.includes(optionId) ? current.filter((id) => id !== optionId) : current.length < 3 ? [...current, optionId] : current)
  }

  const openDiscoveryComparison = () => {
    setSelectedStepId(undefined)
    window.setTimeout(() => { if (comparisonDialog.current && !comparisonDialog.current.open) comparisonDialog.current.showModal() }, 0)
  }

  const showAgentComparison = useCallback((resourceIds: string[]) => {
    setSelectedStepId(undefined)
    setComparisonIds([...new Set(resourceIds)].slice(0, 3))
    window.setTimeout(() => { if (comparisonDialog.current && !comparisonDialog.current.open) comparisonDialog.current.showModal() }, 0)
  }, [])

  const showAgentDetails = useCallback((resourceId: string) => {
    setSelectedOptionId(resourceId)
    setSelectedStepId(undefined)
    window.setTimeout(() => { if (detailsDialog.current && !detailsDialog.current.open) detailsDialog.current.showModal() }, 0)
  }, [])

  const bridge = useMemo(() => ({ state, prepareDiscovery, build, revise, updateProgress, replan, showResourceDetails: showAgentDetails, showComparison: showAgentComparison, recordTool }), [build, prepareDiscovery, recordTool, replan, revise, showAgentComparison, showAgentDetails, state, updateProgress])
  useEffect(() => {
    const registration = registerPathwayTools(bridge)
    setWebMcpSupported(registration.supported)
    setTools(registration.names)
    return registration.cleanup
  }, [bridge])

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#main" aria-label="Pathway home"><span className="brand-mark"><Map size={18} /></span><span>Pathway</span></a>
      <div className="topbar-meta">
        <details className="tool-status">
          <summary className={`connection ${webMcpSupported ? 'is-live' : ''}`}><span className="connection-dot" />{webMcpSupported ? `${tools.length} agent tools ready` : 'Works without an agent'}<ChevronDown size={14} /></summary>
          <div className="tool-popover"><div className="tool-popover-heading"><div><strong>WebMCP tools</strong><span>Structured actions for this page state</span></div><span>{tools.length}</span></div>
            {webMcpSupported ? <ul>{tools.map((tool) => <li key={tool}><code>{tool}</code><span className={writeTools.has(tool) ? 'tool-write' : 'tool-read'}>{writeTools.has(tool) ? 'Updates draft' : 'Reads data'}</span></li>)}</ul> : <p>Pathway works normally here. A compatible browser lets an agent use structured data and safe actions instead of clicking through the interface.</p>}
            <small>Agents can build and revise drafts. Only a person can approve or save.</small>
          </div>
        </details>
        <button className="button button-quiet" type="button" onClick={resetDemo}><RefreshCcw size={16} /> Reset demo</button>
      </div>
    </header>

    <main id="main">
      <JourneyStrip active={journeyStage} />
      {!roadmap && !state.discovery ? <section className="builder-view" aria-labelledby="page-title">
        <div className="intro-copy">
          <p className="eyebrow"><Sparkles size={15} /> One request. Multiple sources. One path you control.</p>
          <h1 id="page-title">Turn a learning goal into a path you can trust.</h1>
          <p className="lede">Tell Pathway what you want to achieve and what your real limits are. Your browser agent coordinates the search; you inspect the sources, shape the path, and approve the result.</p>
          <div className="impact-contrast" aria-label="Why use WebMCP"><div><span>Without WebMCP</span><strong>Repeat filters across course sites, compare prerequisites, then rebuild the schedule yourself.</strong></div><div><span>With WebMCP</span><strong>One request becomes a visible query, coordinated filters, a source shortlist, and a revisable draft.</strong></div></div>
          <div className="agent-note"><Bot size={20} /><div><strong>The agent works with the page, not around it.</strong><span>Structured tools read the catalog and update visible draft state. Nothing is purchased, enrolled, approved, or saved for you.</span></div></div>
          <div className="source-line"><span>Current demo coverage</span><strong>Commercial photography</strong><strong>Workshop facilitation</strong></div>
        </div>

        <form className="goal-form" onSubmit={submitGoal}>
          <div className="form-heading"><div><p className="section-kicker">Start with a real question</p><h2>What do you want to learn?</h2></div><span className="step-label">Search first</span></div>
          <label className="field field-wide"><span>Learning goal</span><textarea id="learning-goal" value={brief} onChange={(event) => setBrief(event.target.value)} rows={4} required maxLength={220} placeholder="What do you want to learn, and why now?" /><small>Write normally. A browser agent can turn this into the query and filters below.</small></label>
          <div className="demo-launch"><WandSparkles size={17} /><div><strong>Need a fast judge walkthrough?</strong><span>Load a realistic career transition brief, then edit it or ask an agent to search.</span></div><button className="button button-secondary" type="button" onClick={loadJudgeExample}>Load example</button></div>
          <label className="field field-wide"><span>Result you want <em>Optional</em></span><textarea value={formGoal.outcome} onChange={(event) => setFormGoal({ ...formGoal, outcome: event.target.value })} rows={3} maxLength={160} placeholder="For example: a portfolio I can show potential clients." /></label>
          <label className="field field-wide"><span>What do you already know? <em>Optional</em></span><input value={skillsText} onChange={(event) => setSkillsText(event.target.value)} placeholder="For example: basic photo editing, social media content" /><small>Separate skills with commas. Pathway will show what it can skip and what still needs work.</small></label>
          <div className="form-grid"><label className="field"><span>Weeks</span><input type="number" min="1" max="52" value={formGoal.weeks} onChange={(event) => setFormGoal({ ...formGoal, weeks: Number(event.target.value) })} /></label><label className="field"><span>Hours each week</span><input type="number" min="1" max="40" value={formGoal.hoursPerWeek} onChange={(event) => setFormGoal({ ...formGoal, hoursPerWeek: Number(event.target.value) })} /></label><label className="field"><span>Budget in USD</span><input type="number" min="0" max="10000" value={formGoal.budgetUsd} onChange={(event) => setFormGoal({ ...formGoal, budgetUsd: Number(event.target.value) })} /></label><label className="field"><span>Preferred language</span><select value={formGoal.language} onChange={(event) => setFormGoal({ ...formGoal, language: event.target.value })}><option>Spanish</option><option>English</option></select></label><label className="field"><span>Preferred resource</span><select value={formGoal.preferredFormat} onChange={(event) => setFormGoal({ ...formGoal, preferredFormat: event.target.value as LearningGoal['preferredFormat'] })}><option value="any">Any useful format</option><option value="course">Course</option><option value="guide">Guide</option><option value="exercise">Exercise</option><option value="project">Project</option><option value="video">Video</option></select></label></div>
          <div className="constraint-checks"><label className="checkbox-field"><input type="checkbox" checked={formGoal.freeOnly} onChange={(event) => setFormGoal({ ...formGoal, freeOnly: event.target.checked })} /><span><strong>Free resources only</strong><small>Exclude paid catalog options.</small></span></label><label className="checkbox-field"><input type="checkbox" checked={formGoal.asyncOnly} onChange={(event) => setFormGoal({ ...formGoal, asyncOnly: event.target.checked })} /><span><strong>Async only</strong><small>No scheduled sessions required.</small></span></label></div>
          <button className="button button-primary button-large" type="submit"><Search size={18} /> Search learning resources <ArrowUpRight size={18} /></button>
          <p className="form-footnote"><ShieldCheck size={15} /> This demo currently has curated resource coverage for commercial photography and workshop facilitation. Links are real references; time and price are planning estimates.</p>
        </form>
      </section> : !roadmap && discovery ? <section className="discovery-view" aria-labelledby="search-results">
        <div className="discovery-heading">
          <div><p className="eyebrow"><Sparkles size={15} /> Search before committing to a path.</p><h1 id="search-results" tabIndex={-1}>Resources for your goal.</h1><p>{discovery.brief}</p></div>
          <button className="button button-secondary" type="button" onClick={() => setState((current) => ({ ...current, discovery: undefined }))}>Edit search</button>
        </div>
        <section className="webmcp-proof" aria-label="WebMCP impact"><Bot size={21} /><div><span>WebMCP in action</span><strong>One request coordinated {skillsText ? 6 : 5} constraint groups across {new Set(discoveryResults.map((item) => item.provider)).size} sources.</strong></div></section>
        <section className="search-interpretation" aria-label="Visible agent interpretation">
          <div><span>Search query</span><strong>{discovery.query}</strong><small>Mapped from your goal for the curated demo catalog.</small></div>
          <div><span>Search preferences</span><strong>{formGoal.language} · {formGoal.asyncOnly ? 'async' : 'mixed'} · {formGoal.freeOnly ? 'free only' : `$${formGoal.budgetUsd} per resource`} · {formGoal.preferredFormat === 'any' ? 'any format' : `prefer ${formGoal.preferredFormat}`}</strong><small>{skillsText || 'No prior skills recorded'}</small></div>
          <div><span>Plan limits</span><strong>{formGoal.weeks} weeks · {formGoal.hoursPerWeek}h each week · ${formGoal.budgetUsd} total</strong><small>These limits are checked when the path is built.</small></div>
          <div><span>Catalog coverage</span><strong>{getLearningTemplate(discovery.templateId)?.name}</strong><small>The agent made this category match explicit so you can correct it.</small></div>
        </section>
        <div className="discovery-layout"><section className="resource-results"><div className="section-heading"><div><p className="section-kicker">Short list</p><h2>{discoveryResults.length} resources worth reviewing</h2></div><div className="resource-toolbar"><span>{comparisonIds.length ? `${comparisonIds.length} selected` : 'Search results'}</span>{comparisonIds.length >= 2 && <button className="button button-secondary" type="button" onClick={openDiscoveryComparison}><GitCompareArrows size={15} /> Compare selected</button>}</div></div><div className="resource-list">{discoveryResults.map((option) => {
          const selectedForComparison = comparisonIds.includes(option.id)
          return <article className={`resource-card ${selectedForComparison ? 'is-selected' : ''}`} key={option.id}><div><span className="resource-provider">{option.provider} · {option.format}</span><h3>{option.title}</h3><p>{option.description}</p><div className="course-facts"><span><Clock3 size={14} /> {option.durationHours}h</span><span>{formatMoney(option.priceUsd)}</span><span>{option.languages.join(' · ')}</span></div></div><div className="resource-outcome"><span>Helps you do</span><strong>{option.learningOutcome}</strong><small>{option.sourceConfidence} · checked {option.lastChecked}</small><div className="resource-actions"><button className="button button-quiet" type="button" onClick={() => openDetails(option.id, '')}>Details</button><button className={`button ${selectedForComparison ? 'button-complete' : 'button-secondary'}`} type="button" disabled={!selectedForComparison && comparisonIds.length >= 3} onClick={() => toggleDiscoveryComparison(option.id)}>{selectedForComparison ? <><Check size={14} /> Selected</> : 'Compare'}</button></div></div></article>
        })}</div></section>
          <aside className="discovery-actions"><section className="review-card review-primary"><div className="review-icon"><Search size={20} /></div><p className="section-kicker">Your decision point</p><h2>Do these resources look right?</h2><p>Search does not create a plan. Compare or inspect them first; when the direction feels right, create a draft path from this visible short list.</p><button className="button button-primary button-block" type="button" onClick={() => build(state.goal, state.discovery?.resultIds, comparisonIds)}><ArrowUpRight size={17} /> Create draft path</button><button className="button button-quiet button-block" type="button" onClick={() => setState((current) => ({ ...current, discovery: undefined }))}>Change the brief or filters</button></section><details className="agent-panel"><summary><span><Bot size={16} /> Agent activity</span><span>{toolTrace.length} calls</span></summary><div className="agent-panel-body"><p>The agent uses structured search fields. It never needs to guess cards or buttons.</p>{toolTrace.length ? toolTrace.map((entry) => <div className="trace-row" key={entry.id}><i className={`trace-status ${entry.status === 'error' ? 'error' : ''}`} /><div><strong>{entry.name}</strong><small>{entry.time} · {entry.status}</small></div></div>) : <div className="empty-trace">Ask your browser agent to prepare a search, then its query and filters will appear here.</div>}</div></details></aside>
        </div>
      </section> : roadmap ? <section className="plan-view" aria-labelledby="roadmap-title">
        <div className="plan-heading"><div><p className="eyebrow"><span className={`status-dot status-${roadmap.status}`} />{roadmap.status === 'saved' ? 'Saved learning path' : roadmap.status === 'approved' ? 'Approved by you' : 'Draft for your review'}</p><h1 id="roadmap-title">{roadmap.goal.topic}</h1><p>{roadmap.goal.outcome}</p></div><div className="plan-revision"><span>Revision</span><strong>{roadmap.revisionId}</strong></div></div>
        <div className="constraint-rail" aria-label="Learning constraints"><div><Clock3 /><span>Study load</span><strong>{roadmap.totals.weeklyHours}h / {roadmap.goal.hoursPerWeek}h weekly</strong><em className={roadmap.totals.withinTime ? 'check-ok' : 'check-warning'}>{roadmap.totals.withinTime ? 'Fits your time' : 'Over your limit'}</em></div><div><DollarSign /><span>Total estimate</span><strong>{formatMoney(roadmap.totals.costUsd)} / ${roadmap.goal.budgetUsd}</strong><em className={roadmap.totals.withinBudget ? 'check-ok' : 'check-warning'}>{roadmap.totals.withinBudget ? 'Within budget' : 'Over your budget'}</em></div><div><Languages /><span>Language</span><strong>{roadmap.goal.language}</strong><em className={roadmap.totals.preferredLanguageCount === roadmap.steps.length ? 'check-ok' : 'check-warning'}>{roadmap.totals.preferredLanguageCount} of {roadmap.steps.length} matched</em></div><div><BookOpen /><span>Access</span><strong>{roadmap.goal.asyncOnly ? 'Async only' : 'Mixed formats'}</strong><em className="check-ok">{roadmap.totals.asyncCount} async resources</em></div></div>
        <section className="skill-gap" aria-labelledby="gap-title"><div><p className="section-kicker">Your starting point</p><h2 id="gap-title">What this path will build</h2></div><div className="gap-columns"><div><span>You bring</span><strong>{roadmap.skillGap.known.join(' · ') || 'Nothing recorded yet'}</strong></div><div><span>Pathway will build</span><strong>{roadmap.skillGap.needed.join(' · ')}</strong></div>{roadmap.skillGap.skipped.length > 0 && <div><span>Skipped because you know it</span><strong>{roadmap.skillGap.skipped.join(' · ')}</strong></div>}</div></section>
        {roadmap.status === 'saved' && <section className="progress-strip"><div className="progress-copy"><span>Learning progress</span><strong>{completedCount === roadmap.steps.length ? 'Portfolio path complete' : `${completedCount} of ${roadmap.steps.length} steps complete`}</strong></div><div className="progress-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><i style={{ width: `${progressPercent}%` }} /></div><span className="progress-percent">{progressPercent}%</span></section>}
        <div className="plan-layout"><div className="roadmap-column"><div className="section-heading"><div><p className="section-kicker">Your evidence path</p><h2 id="roadmap" tabIndex={-1}>Learn it. Practice it. Show it.</h2></div><span>{roadmap.steps.length} steps</span></div><ol className="roadmap-list">{roadmap.steps.map((step, index) => {
          const option = state.catalog.find((item) => item.id === step.optionId)
          const complete = completedSet.has(step.id)
          const canComplete = roadmap.status === 'saved' && (complete || nextIncompleteStep?.id === step.id)
          if (!option) return null
          return <li className={`roadmap-step ${complete ? 'is-complete' : ''}`} key={step.id}><div className="step-track"><span>{complete ? <Check size={15} /> : index + 1}</span>{index < roadmap.steps.length - 1 && <i />}</div><article className={`course-card ${complete ? 'is-complete' : ''}`}><div className="course-main"><div className="course-label"><span className={`stage-kind stage-${step.kind}`}>{kindLabel(step.kind)}</span><em>{option.provider} · {option.format}</em></div><h3>{step.title}</h3><p>{option.description}</p><div className="course-facts"><span><Clock3 size={14} /> {option.durationHours}h</span><span>{formatMoney(option.priceUsd)}</span><span>{option.languages.join(' · ')}</span></div><div className="deliverable"><Target size={15} /><div><span>Proof to make</span><strong>{step.deliverable}</strong></div></div></div><div className="course-choice"><p><Check size={15} /> {step.reason}</p><div className="course-actions">{roadmap.status === 'saved' && <button className={`button ${complete ? 'button-complete' : 'button-secondary'}`} type="button" disabled={!canComplete} onClick={() => toggleProgress(step.id)}>{complete ? <><Check size={15} /> Completed</> : 'Mark complete'}</button>}{step.alternativeIds.length > 0 && roadmap.status !== 'saved' && <button className="button button-quiet" type="button" onClick={() => openComparison(step.id)}><GitCompareArrows size={15} /> Compare</button>}<button className="button button-secondary" type="button" onClick={() => openDetails(option.id, step.id)}>Source details <ChevronDown size={15} /></button></div></div></article></li>
        })}</ol>
        <section className="weekly-schedule" id="weekly-schedule"><div className="section-heading"><div><p className="section-kicker"><CalendarDays size={14} /> Your weekly rhythm</p><h2>{roadmap.schedule.replannedAt ? 'Finished work stays put. The rest adapts.' : 'A schedule you can actually follow'}</h2></div><span>{roadmap.schedule.remainingHours ?? roadmap.schedule.totalHours} hours</span></div><div className="week-list">{roadmap.schedule.weeks.map((week) => <article className={`week-row ${week.status === 'completed' ? 'is-completed' : ''}`} key={week.week}><div className="week-number"><span>Week</span><strong>{String(week.week).padStart(2, '0')}</strong></div><div className="week-work"><strong>{week.milestone}</strong>{week.blocks.length ? week.blocks.map((block) => <p key={`${block.stepId}-${block.hours}`}><span>{block.competency}</span><em>{block.hours}h{block.completesStep ? ' · finish' : ''}</em></p>) : <p><span>Review, practice, and catch up</span><em>Flexible</em></p>}</div><span className="week-hours">{week.hours ? `${week.hours}h` : 'Open'}</span></article>)}</div></section></div>
          <aside className="review-column"><section className="review-card review-primary"><div className="review-icon"><LockKeyhole size={20} /></div><p className="section-kicker">Human approval</p><h2>{roadmap.status === 'saved' ? 'Your path is saved.' : roadmap.status === 'approved' ? 'Approved. Ready to save.' : 'Review this exact draft.'}</h2><p>{roadmap.status === 'saved' ? 'This path and progress live only in this browser. No provider was contacted.' : roadmap.status === 'approved' ? 'Only you can save this approved revision. An agent has no save or enrollment tool.' : 'Check the evidence, source details, workload, and cost. Any revision clears approval.'}</p>{roadmap.status === 'draft' && <button className="button button-primary button-block" type="button" onClick={approve}><Check size={17} /> Approve this path</button>}{roadmap.status === 'approved' && <button className="button button-primary button-block" type="button" onClick={save}><BookOpen size={17} /> Save approved path</button>}{roadmap.status === 'saved' && <div className="saved-state"><Check size={18} /> Saved in this browser</div>}</section>
          {roadmap.status === 'draft' && <details className="review-card revision-card" open><summary><span className="section-kicker">Need a different fit?</span><h2>Revise the whole draft</h2></summary><p>Change the learner's constraints here, or ask a WebMCP agent to do the same. The new sources and schedule will return for approval.</p><form className="revision-editor" onSubmit={submitRevision}><label className="field"><span>What the learner already knows</span><input value={skillsText} onChange={(event) => setSkillsText(event.target.value)} placeholder="For example: basic photo editing" /></label><div className="form-grid"><label className="field"><span>Weeks</span><input type="number" min="1" max="52" value={formGoal.weeks} onChange={(event) => setFormGoal({ ...formGoal, weeks: Number(event.target.value) })} /></label><label className="field"><span>Hours each week</span><input type="number" min="1" max="40" value={formGoal.hoursPerWeek} onChange={(event) => setFormGoal({ ...formGoal, hoursPerWeek: Number(event.target.value) })} /></label><label className="field"><span>Budget in USD</span><input type="number" min="0" max="10000" value={formGoal.budgetUsd} onChange={(event) => setFormGoal({ ...formGoal, budgetUsd: Number(event.target.value) })} /></label><label className="field"><span>Preferred language</span><select value={formGoal.language} onChange={(event) => setFormGoal({ ...formGoal, language: event.target.value })}><option>Spanish</option><option>English</option></select></label><label className="field"><span>Preferred resource</span><select value={formGoal.preferredFormat} onChange={(event) => setFormGoal({ ...formGoal, preferredFormat: event.target.value as LearningGoal['preferredFormat'] })}><option value="any">Any useful format</option><option value="course">Course</option><option value="guide">Guide</option><option value="exercise">Exercise</option><option value="project">Project</option><option value="video">Video</option></select></label></div><div className="constraint-checks"><label className="checkbox-field"><input type="checkbox" checked={formGoal.freeOnly} onChange={(event) => setFormGoal({ ...formGoal, freeOnly: event.target.checked })} /><span><strong>Free resources only</strong><small>Exclude paid catalog options.</small></span></label><label className="checkbox-field"><input type="checkbox" checked={formGoal.asyncOnly} onChange={(event) => setFormGoal({ ...formGoal, asyncOnly: event.target.checked })} /><span><strong>Async only</strong><small>No scheduled sessions required.</small></span></label></div><label className="field"><span>Why should this change?</span><input value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} minLength={5} maxLength={140} required /></label><button className="button button-secondary button-block" type="submit"><RefreshCcw size={16} /> Revise and show the new draft</button></form></details>}
          {canReplan && <section className="review-card progress-card"><p className="section-kicker">Continue learning</p><h2>{roadmap.steps.length - completedCount} steps left.</h2><p>Finished work stays locked. Replan the remaining weeks only when the learner wants a new timeline.</p><button className="button button-primary button-block" type="button" onClick={() => { const result = replan(); notify(result.ok ? 'Remaining weeks replanned; approve the new draft' : (result.error ?? 'Could not replan unfinished work')) }}><RefreshCcw size={16} /> Replan unfinished weeks</button></section>}
          <details className="agent-panel"><summary><span><Bot size={16} /> Agent activity on this page</span><span>{toolTrace.length} calls</span></summary><div className="agent-panel-body"><p>Trace only. It shows structured WebMCP calls; it is not a chat transcript.</p>{toolTrace.length ? toolTrace.map((entry) => <div className="trace-row" key={entry.id}><i className={`trace-status ${entry.status === 'error' ? 'error' : ''}`} /><div><strong>{entry.name}</strong><small>{entry.time} · {entry.status}</small></div></div>) : <div className="empty-trace">No agent calls yet. The normal interface remains fully usable.</div>}</div></details></aside>
        </div>
      </section> : null}
    </main>

    <dialog className="course-dialog" ref={detailsDialog}>{selectedOption && <div className="dialog-content"><div className="dialog-top"><div><p className="section-kicker">{selectedOption.provider} · {selectedOption.format}</p><h2>{selectedOption.title}</h2></div><button className="icon-button" onClick={() => detailsDialog.current?.close()} aria-label="Close details"><X size={18} /></button></div><p className="dialog-description">{selectedOption.description}</p><dl className="detail-grid"><div><dt>Time</dt><dd>{selectedOption.durationHours} hours</dd></div><div><dt>Cost</dt><dd>{formatMoney(selectedOption.priceUsd)}</dd></div><div><dt>Language</dt><dd>{selectedOption.languages.join(' / ')}</dd></div><div><dt>Access</dt><dd>{selectedOption.availability}</dd></div></dl><section className="detail-section"><h3>What it helps you do</h3><p>{selectedOption.learningOutcome}</p></section><section className="detail-section"><h3>Skills and requirements</h3><div className="tag-list">{selectedOption.skills.map((skill) => <span key={skill}>{skill}</span>)}{selectedOption.prerequisites.map((item) => <span key={item}>Requires: {item}</span>)}</div></section><div className="source-note"><ShieldCheck size={18} /><div><strong>{selectedOption.sourceConfidence} · checked {selectedOption.lastChecked}</strong><span>{selectedOption.sourceNote} Confirm the current offering, price, and availability on the original source before acting.</span></div></div><a className="button button-primary button-block" href={selectedOption.url} target="_blank" rel="noreferrer">Open original source <ExternalLink size={16} /></a>{selectedStep && <p className="dialog-footnote">This source supports: {selectedStep.deliverable}</p>}</div>}</dialog>
    <dialog className="comparison-dialog" ref={comparisonDialog}><div className="comparison-content"><div className="dialog-top"><div><p className="section-kicker">Compare across sources</p><h2>{selectedStep ? 'Choose the evidence that fits you.' : 'Inspect the tradeoffs before building.'}</h2><p>{selectedStep ? 'Selecting an alternative creates a fresh draft for review.' : 'This comparison changes nothing. Return to the short list when the sources look right.'}</p></div><button className="icon-button" onClick={() => comparisonDialog.current?.close()} aria-label="Close comparison"><X size={18} /></button></div><div className="comparison-scroll"><table className="comparison-table"><thead><tr><th>Resource</th>{comparison.map((item) => <th key={item.id}><span>{item.provider}</span><strong>{item.title}</strong><em>{item.format}</em></th>)}</tr></thead><tbody>{[['Time', (item: typeof comparison[number]) => `${item.durationHours} hours`], ['Cost', (item: typeof comparison[number]) => formatMoney(item.priceUsd)], ['Language', (item: typeof comparison[number]) => item.languages.join(', ')], ['Outcome', (item: typeof comparison[number]) => item.learningOutcome], ['Source', (item: typeof comparison[number]) => `${item.sourceConfidence} · ${item.lastChecked}`]].map(([label, value]) => <tr key={label as string}><th>{label as string}</th>{comparison.map((item) => <td key={item.id}>{(value as (item: typeof comparison[number]) => string)(item)}{item.fit?.preferredLanguage && <span className="fit-mark"><Check size={11} /> Language fit</span>}</td>)}</tr>)}{selectedStep && <tr className="comparison-actions-row"><th>Choose</th>{comparison.map((item) => <td key={item.id}>{item.id === selectedStep.optionId ? <span className="current-choice"><Check size={12} /> Current choice</span> : <button className="button button-secondary" type="button" onClick={() => replaceOption(selectedStep.id, item.id)}>Use this resource</button>}</td>)}</tr>}</tbody></table></div><p className="comparison-foot"><ShieldCheck size={15} /> The comparison uses the static catalog snapshot. Original source details stay visible so the learner can verify claims before committing.</p></div></dialog>
    {toast && <div className="toast"><Check size={16} /> {toast}</div>}
  </div>
}

export default App
