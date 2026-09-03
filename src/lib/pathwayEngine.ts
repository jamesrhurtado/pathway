import { getLearningTemplate } from '../data/catalog'
import type { LearningGoal, LearningOption, LearningProgress, PathwayState, Roadmap, RoadmapRevisionInput, RoadmapStep, RoadmapTotals, ScheduleWeek, SkillGapSummary } from '../types'

function normalize(value: string) {
  return value.trim().toLocaleLowerCase()
}

function expandedKnownSkills(skills: string[]) {
  const known = new Set(skills.map(normalize))
  if ([...known].some((skill) => skill.includes('docker') || skill.includes('container'))) known.add('containers')
  if ([...known].some((skill) => skill.includes('kubernetes basic'))) known.add('kubernetes foundations')
  return known
}

function covers(option: LearningOption, competency: string) {
  return option.skills.some((candidate) => normalize(candidate) === normalize(competency))
}

function optionScore(option: LearningOption, goal: LearningGoal) {
  const languagePenalty = option.languages.some((language) => normalize(language) === normalize(goal.language)) ? 0 : 100
  const formatPenalty = goal.preferredFormat === 'any' || option.format === goal.preferredFormat ? 0 : 12
  return languagePenalty + formatPenalty + option.priceUsd * 0.2 + option.durationHours
}

function matchingOptions(catalog: LearningOption[], competency: string, goal: LearningGoal) {
  return catalog
    .filter((option) => option.domain === goal.templateId && covers(option, competency))
    .filter((option) => !goal.freeOnly || option.priceUsd === 0)
    .filter((option) => !goal.asyncOnly || option.availability === 'async')
    .filter((option) => option.priceUsd <= goal.budgetUsd)
    .sort((left, right) => optionScore(left, goal) - optionScore(right, goal))
}

export function validateLearningGoal(goal: LearningGoal) {
  const errors: string[] = []
  const template = getLearningTemplate(goal.templateId)
  if (!template) errors.push('Choose one of the supported learning paths.')
  if (!goal.outcome.trim()) errors.push('Describe what you want to be able to do.')
  if (!Number.isInteger(goal.weeks) || goal.weeks < 1 || goal.weeks > 52) errors.push('Weeks must be between 1 and 52.')
  if (!Number.isFinite(goal.hoursPerWeek) || goal.hoursPerWeek < 1 || goal.hoursPerWeek > 40) errors.push('Hours per week must be between 1 and 40.')
  if (!Number.isFinite(goal.budgetUsd) || goal.budgetUsd < 0 || goal.budgetUsd > 10000) errors.push('Budget must be between $0 and $10,000.')
  if (!goal.language.trim()) errors.push('Choose a preferred language.')
  return errors
}

export function searchLearningOptions(catalog: LearningOption[], query: string, filters: { domain?: LearningGoal['templateId']; language?: string; freeOnly?: boolean; asyncOnly?: boolean; format?: LearningGoal['preferredFormat']; budgetUsd?: number; maxHours?: number; limit?: number } = {}) {
  const words = normalize(query).split(/\s+/).filter((word) => word.length > 2)
  return catalog
    .filter((option) => !filters.domain || option.domain === filters.domain)
    .filter((option) => !filters.freeOnly || option.priceUsd === 0)
    .filter((option) => !filters.asyncOnly || option.availability === 'async')
    .filter((option) => !filters.format || filters.format === 'any' || option.format === filters.format)
    .filter((option) => filters.budgetUsd === undefined || option.priceUsd <= filters.budgetUsd)
    .filter((option) => filters.maxHours === undefined || option.durationHours <= filters.maxHours)
    .map((option) => {
      const haystack = normalize([option.title, option.description, option.learningOutcome, ...option.skills, ...option.prerequisites].join(' '))
      const matches = words.filter((word) => haystack.includes(word)).length
      const languageMatch = filters.language ? option.languages.some((item) => normalize(item) === normalize(filters.language!)) : false
      return { option, score: matches * 10 + (languageMatch ? 3 : 0) - option.durationHours * 0.01 }
    })
    .filter(({ score }) => score > 0 || words.length === 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(Math.max(filters.limit ?? 5, 1), 8))
    .map(({ option }) => option)
}

function totalsFor(steps: RoadmapStep[], catalog: LearningOption[], goal: LearningGoal): RoadmapTotals {
  const options = steps.map((step) => catalog.find((option) => option.id === step.optionId)).filter((option): option is LearningOption => Boolean(option))
  const hours = options.reduce((sum, option) => sum + option.durationHours, 0)
  const costUsd = options.reduce((sum, option) => sum + option.priceUsd, 0)
  return {
    hours,
    costUsd,
    weeklyHours: Number((hours / goal.weeks).toFixed(1)),
    weeks: goal.weeks,
    withinTime: hours <= goal.weeks * goal.hoursPerWeek,
    withinBudget: costUsd <= goal.budgetUsd,
    preferredLanguageCount: options.filter((option) => option.languages.some((language) => normalize(language) === normalize(goal.language))).length,
    asyncCount: options.filter((option) => option.availability === 'async').length,
  }
}

function skillGapFor(goal: LearningGoal): SkillGapSummary {
  const template = getLearningTemplate(goal.templateId)!
  const known = expandedKnownSkills(goal.knownSkills)
  const skipped = template.stages.filter((stage) => known.has(normalize(stage.competency))).map((stage) => stage.competency)
  return {
    known: goal.knownSkills,
    needed: template.stages.filter((stage) => !skipped.includes(stage.competency)).map((stage) => stage.competency),
    skipped,
  }
}

function warningsFor(steps: RoadmapStep[], catalog: LearningOption[], goal: LearningGoal, totals: RoadmapTotals) {
  const warnings: string[] = []
  if (!totals.withinTime) warnings.push(`The selected resources need ${totals.hours} hours, but the plan allows ${goal.weeks * goal.hoursPerWeek}.`)
  if (!totals.withinBudget) warnings.push(`The selected resources cost $${totals.costUsd}, above the $${goal.budgetUsd} budget.`)
  const languageMisses = steps.length - totals.preferredLanguageCount
  if (languageMisses > 0) warnings.push(`${languageMisses} ${languageMisses === 1 ? 'step has' : 'steps have'} no ${goal.language} option in the catalog.`)
  const known = expandedKnownSkills(goal.knownSkills)
  for (const step of steps) {
    const option = catalog.find((item) => item.id === step.optionId)
    if (!option) continue
    const unmet = option.prerequisites.filter((requirement) => !known.has(normalize(requirement)) && !steps.slice(0, step.order - 1).some((prior) => normalize(prior.competency) === normalize(requirement)))
    if (unmet.length) warnings.push(`${option.title} still requires ${unmet.join(', ')}.`)
  }
  return [...new Set(warnings)]
}

function revisionHash(roadmap: Pick<Roadmap, 'revision' | 'stateVersion' | 'goal' | 'steps' | 'schedule'>) {
  const value = JSON.stringify({ revision: roadmap.revision, stateVersion: roadmap.stateVersion, goal: roadmap.goal, steps: roadmap.steps.map(({ competency, optionId }) => ({ competency, optionId })), schedule: roadmap.schedule.weeks.map((week) => week.blocks.map(({ stepId, optionId, hours }) => ({ stepId, optionId, hours }))) })
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `plan-${roadmap.revision}-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function buildSteps(goal: LearningGoal, catalog: LearningOption[], candidateIds?: string[], preferredOptionIds: string[] = []) {
  const template = getLearningTemplate(goal.templateId)!
  const known = expandedKnownSkills(goal.knownSkills)
  const candidates = candidateIds ? catalog.filter((option) => candidateIds.includes(option.id)) : catalog
  const preferred = new Set(preferredOptionIds)
  const steps: RoadmapStep[] = []
  for (const stage of template.stages) {
    if (known.has(normalize(stage.competency))) continue
    const options = matchingOptions(candidates, stage.competency, goal).sort((left, right) => {
      const leftPreferred = preferred.has(left.id) ? 0 : 1
      const rightPreferred = preferred.has(right.id) ? 0 : 1
      return leftPreferred - rightPreferred
    })
    const selected = options[0]
    if (!selected) continue
    steps.push({
      id: `step-${steps.length + 1}`,
      order: steps.length + 1,
      competency: stage.competency,
      title: stage.title,
      kind: stage.kind,
      deliverable: stage.deliverable,
      optionId: selected.id,
      alternativeIds: options.slice(1, 4).map((option) => option.id),
      reason: `${selected.languages.some((language) => normalize(language) === normalize(goal.language)) ? `Available in ${goal.language}` : 'Best available language match'} · ${selected.durationHours}h · ${selected.priceUsd === 0 ? 'free' : `$${selected.priceUsd}`} · ${selected.format}`,
    })
  }
  return steps
}

function distributeSchedule(steps: RoadmapStep[], catalog: LearningOption[], startWeek: number, weekCount: number, hoursPerWeek: number) {
  const remaining = steps.map((step) => {
    const option = catalog.find((item) => item.id === step.optionId)
    if (!option) throw new Error(`The source for ${step.title} is missing.`)
    return { step, option, minutes: Math.round(option.durationHours * 60) }
  })
  const totalMinutes = remaining.reduce((sum, item) => sum + item.minutes, 0)
  const weeklyCapacity = Math.round(hoursPerWeek * 60)
  if (totalMinutes > weeklyCapacity * weekCount) throw new Error(`The remaining ${Number((totalMinutes / 60).toFixed(1))} hours do not fit in ${weekCount} weeks at ${hoursPerWeek} hours per week.`)

  const weeks: ScheduleWeek[] = []
  let cursor = 0
  let minutesLeft = totalMinutes
  for (let offset = 0; offset < weekCount; offset += 1) {
    const weeksLeft = weekCount - offset
    let allowance = Math.min(weeklyCapacity, Math.ceil(minutesLeft / weeksLeft))
    const blocks: ScheduleWeek['blocks'] = []
    while (allowance > 0 && cursor < remaining.length) {
      const item = remaining[cursor]
      const assigned = Math.min(allowance, item.minutes)
      item.minutes -= assigned
      allowance -= assigned
      minutesLeft -= assigned
      blocks.push({ stepId: item.step.id, optionId: item.option.id, title: item.option.title, competency: item.step.competency, hours: Number((assigned / 60).toFixed(1)), completesStep: item.minutes === 0 })
      if (item.minutes === 0) cursor += 1
    }
    const completed = [...blocks].reverse().find((block) => block.completesStep)
    const active = blocks[blocks.length - 1]
    weeks.push({ week: startWeek + offset, hours: Number((blocks.reduce((sum, block) => sum + block.hours, 0)).toFixed(1)), blocks, milestone: completed ? `Finish ${completed.title}` : active ? `Continue ${active.title}` : 'Review, practice, and catch up', status: 'upcoming' })
  }
  return weeks
}

function scheduledRoadmap(base: Omit<Roadmap, 'revisionId'>): Roadmap {
  const revisionId = revisionHash({ ...base, schedule: { ...base.schedule, roadmapRevisionId: '' } })
  return { ...base, revisionId, schedule: { ...base.schedule, roadmapRevisionId: revisionId } }
}

export function buildRoadmap(goal: LearningGoal, catalog: LearningOption[], stateVersion: number, revision = 1, candidateIds?: string[], preferredOptionIds: string[] = []): Roadmap {
  const errors = validateLearningGoal(goal)
  if (errors.length) throw new Error(errors.join(' '))
  const steps = buildSteps(goal, catalog, candidateIds, preferredOptionIds)
  if (!steps.length) throw new Error('No learning resources match this goal. Relax a filter or choose another supported path.')
  const known = expandedKnownSkills(goal.knownSkills)
  const missingCompetencies = getLearningTemplate(goal.templateId)!.stages
    .filter((stage) => !known.has(normalize(stage.competency)))
    .filter((stage) => !steps.some((step) => normalize(step.competency) === normalize(stage.competency)))
    .map((stage) => stage.competency)
  if (missingCompetencies.length) throw new Error(`Review resources covering every remaining skill before building a path: ${missingCompetencies.join(', ')}.`)
  const totals = totalsFor(steps, catalog, goal)
  const warnings = warningsFor(steps, catalog, goal, totals)
  if (warnings.some((warning) => /requires/i.test(warning))) throw new Error('The selected resources have unmet prerequisites. Update what you know or adjust the path.')
  const schedule = { roadmapRevisionId: '', totalHours: totals.hours, weeks: distributeSchedule(steps, catalog, 1, goal.weeks, goal.hoursPerWeek) }
  return scheduledRoadmap({ id: `pathway-${goal.templateId}`, status: 'draft', revision, stateVersion, goal: { ...goal, knownSkills: [...goal.knownSkills] }, skillGap: skillGapFor(goal), steps, totals, warnings, createdAt: new Date().toISOString(), schedule })
}

export function reviseRoadmap(current: Roadmap, state: PathwayState, input: RoadmapRevisionInput) {
  if (current.status === 'saved') throw new Error('The saved roadmap cannot be edited directly. Start a new draft first.')
  if (!input.reason.trim()) throw new Error('Explain why the roadmap should change.')
  const goal: LearningGoal = { ...current.goal, ...(input.knownSkills ? { knownSkills: [...input.knownSkills] } : {}), ...(input.weeks !== undefined ? { weeks: input.weeks } : {}), ...(input.hoursPerWeek !== undefined ? { hoursPerWeek: input.hoursPerWeek } : {}), ...(input.budgetUsd !== undefined ? { budgetUsd: input.budgetUsd } : {}), ...(input.language !== undefined ? { language: input.language } : {}), ...(input.freeOnly !== undefined ? { freeOnly: input.freeOnly } : {}), ...(input.asyncOnly !== undefined ? { asyncOnly: input.asyncOnly } : {}), ...(input.preferredFormat !== undefined ? { preferredFormat: input.preferredFormat } : {}) }
  return buildRoadmap(goal, state.catalog, state.version, current.revision + 1)
}

export function replaceRoadmapOption(current: Roadmap, catalog: LearningOption[], stepId: string, optionId: string, stateVersion = current.stateVersion) {
  if (current.status === 'saved') throw new Error('The saved roadmap cannot be edited directly.')
  const step = current.steps.find((item) => item.id === stepId)
  const option = catalog.find((item) => item.id === optionId)
  if (!step) throw new Error(`Unknown roadmap step: ${stepId}.`)
  if (!option || option.domain !== current.goal.templateId || !covers(option, step.competency)) throw new Error(`Option ${optionId} does not teach ${step.competency}.`)
  const steps = current.steps.map((item) => item.id === stepId ? { ...item, optionId, alternativeIds: [item.optionId, ...item.alternativeIds.filter((id) => id !== optionId)].slice(0, 3), reason: `Selected by the learner · ${option.durationHours}h · ${option.priceUsd === 0 ? 'free' : `$${option.priceUsd}`} · ${option.format}` } : item)
  const totals = totalsFor(steps, catalog, current.goal)
  const schedule = { roadmapRevisionId: '', totalHours: totals.hours, weeks: distributeSchedule(steps, catalog, 1, current.goal.weeks, current.goal.hoursPerWeek) }
  return scheduledRoadmap({ ...current, status: 'draft', revision: current.revision + 1, stateVersion, steps, totals, warnings: warningsFor(steps, catalog, current.goal, totals), schedule, approvedRevisionId: undefined, savedAt: undefined })
}

export function compareLearningOptions(catalog: LearningOption[], optionIds: string[], goal?: LearningGoal) {
  const uniqueIds = [...new Set(optionIds)]
  if (uniqueIds.length < 2 || uniqueIds.length > 3) throw new Error('Compare two or three different learning resources.')
  const options = uniqueIds.map((id) => catalog.find((option) => option.id === id))
  if (options.some((option) => !option)) throw new Error('One or more learning resources are unknown.')
  return options.map((item) => {
    const option = item!
    return { id: option.id, title: option.title, provider: option.provider, durationHours: option.durationHours, priceUsd: option.priceUsd, languages: option.languages, format: option.format, availability: option.availability, level: option.level, skills: option.skills, prerequisites: option.prerequisites, learningOutcome: option.learningOutcome, sourceConfidence: option.sourceConfidence, lastChecked: option.lastChecked, fit: goal ? { withinBudget: option.priceUsd <= goal.budgetUsd, preferredLanguage: option.languages.some((language) => normalize(language) === normalize(goal.language)), async: option.availability === 'async' } : undefined }
  })
}

export function updateLearningProgress(roadmap: Roadmap, current: LearningProgress | undefined, completedStepIds: string[]): LearningProgress {
  if (roadmap.status !== 'saved') throw new Error('Save the approved roadmap before recording progress.')
  const unique = [...new Set(completedStepIds)]
  if (unique.some((id) => !roadmap.steps.some((step) => step.id === id))) throw new Error('Progress includes an unknown roadmap step.')
  const ordered = roadmap.steps.filter((step) => unique.includes(step.id)).map((step) => step.id)
  if (ordered.some((id, index) => id !== roadmap.steps[index].id)) throw new Error('Complete roadmap steps in order so the remaining schedule stays valid.')
  if (current?.roadmapId === roadmap.id && ordered.length < current.completedStepIds.length) return { roadmapId: roadmap.id, completedStepIds: ordered, updatedAt: new Date().toISOString() }
  return { roadmapId: roadmap.id, completedStepIds: ordered, updatedAt: new Date().toISOString() }
}

export function replanRemainingSchedule(current: Roadmap, progress: LearningProgress | undefined, catalog: LearningOption[], stateVersion = current.stateVersion) {
  if (current.status !== 'saved') throw new Error('Save the current plan before replanning progress.')
  const completedIds = progress?.roadmapId === current.id ? progress.completedStepIds : []
  if (!completedIds.length) throw new Error('Mark at least one roadmap step complete before replanning.')
  if (completedIds.length === current.steps.length) throw new Error('Every roadmap step is already complete.')
  const completedSet = new Set(completedIds)
  const elapsedWeek = Math.max(0, ...current.schedule.weeks.filter((week) => week.blocks.some((block) => completedSet.has(block.stepId) && block.completesStep)).map((week) => week.week))
  const remainingWeekCount = current.goal.weeks - elapsedWeek
  if (remainingWeekCount < 1) throw new Error('No planned weeks remain. Extend the roadmap before replanning unfinished work.')
  const completedWeeks = current.schedule.weeks.filter((week) => week.week <= elapsedWeek).map((week) => ({ ...week, blocks: week.blocks.filter((block) => completedSet.has(block.stepId)), status: 'completed' as const }))
  const remainingSteps = current.steps.filter((step) => !completedSet.has(step.id))
  const completedHours = current.steps.filter((step) => completedSet.has(step.id)).reduce((sum, step) => sum + (catalog.find((option) => option.id === step.optionId)?.durationHours ?? 0), 0)
  const remainingHours = current.totals.hours - completedHours
  const schedule = { roadmapRevisionId: '', totalHours: current.totals.hours, completedHours, remainingHours, replannedAt: new Date().toISOString(), weeks: [...completedWeeks, ...distributeSchedule(remainingSteps, catalog, elapsedWeek + 1, remainingWeekCount, current.goal.hoursPerWeek)] }
  return scheduledRoadmap({ ...current, status: 'draft', revision: current.revision + 1, stateVersion, schedule, approvedRevisionId: undefined, savedAt: undefined })
}

export function approveRoadmap(roadmap: Roadmap) {
  if (!roadmap.totals.withinTime || !roadmap.totals.withinBudget) throw new Error('Resolve the time or budget warning before approving this roadmap.')
  if (roadmap.schedule.roadmapRevisionId !== roadmap.revisionId) throw new Error('The schedule is stale. Rebuild the roadmap before approval.')
  return { ...roadmap, status: 'approved' as const, approvedRevisionId: roadmap.revisionId }
}

export function saveApprovedRoadmap(roadmap: Roadmap) {
  if (roadmap.status !== 'approved' || roadmap.approvedRevisionId !== roadmap.revisionId) throw new Error('Approve the exact current roadmap before saving it.')
  return { ...roadmap, status: 'saved' as const, savedAt: new Date().toISOString() }
}

export function roadmapSummary(roadmap: Roadmap, catalog: LearningOption[]) {
  return {
    id: roadmap.id, status: roadmap.status, revisionId: roadmap.revisionId, stateVersion: roadmap.stateVersion,
    goal: roadmap.goal, skillGap: roadmap.skillGap, totals: roadmap.totals, warnings: roadmap.warnings,
    schedule: { totalHours: roadmap.schedule.totalHours, completedHours: roadmap.schedule.completedHours ?? 0, remainingHours: roadmap.schedule.remainingHours ?? roadmap.schedule.totalHours, weeks: roadmap.schedule.weeks },
    steps: roadmap.steps.map((step) => {
      const option = catalog.find((item) => item.id === step.optionId)
      return { order: step.order, kind: step.kind, competency: step.competency, deliverable: step.deliverable, optionId: step.optionId, title: option?.title, provider: option?.provider, format: option?.format, hours: option?.durationHours, priceUsd: option?.priceUsd }
    }),
  }
}
