import { describe, expect, it } from 'vitest'
import { defaultGoal, goalForTemplate, learningCatalog } from '../data/catalog'
import type { PathwayState } from '../types'
import { approveRoadmap, buildRoadmap, compareLearningOptions, replaceRoadmapOption, replanRemainingSchedule, reviseRoadmap, saveApprovedRoadmap, searchLearningOptions, updateLearningProgress, validateLearningGoal } from './pathwayEngine'

describe('Pathway roadmap engine', () => {
  it('builds a genuinely different photography path with proof of work and a schedule', () => {
    const roadmap = buildRoadmap(defaultGoal, learningCatalog, 1)
    expect(roadmap.steps.map((step) => step.competency)).toEqual(['Visual storytelling', 'Camera and exposure', 'Subject styling and lighting', 'Editing workflow', 'Portfolio and client delivery'])
    expect(roadmap.steps.map((step) => step.kind)).toEqual(['learn', 'practice', 'practice', 'learn', 'produce'])
    expect(roadmap.steps.at(-1)?.deliverable).toMatch(/six-image commercial portfolio/i)
    expect(roadmap.schedule.weeks).toHaveLength(8)
    expect(roadmap.totals).toMatchObject({ hours: 22, costUsd: 0, withinTime: true, withinBudget: true, preferredLanguageCount: 5 })
  })

  it('switches domains instead of disguising one hard-coded route', () => {
    const workshop = buildRoadmap(goalForTemplate('facilitation'), learningCatalog, 1)
    const technical = buildRoadmap(goalForTemplate('kubernetes'), learningCatalog, 1)
    expect(workshop.steps.map((step) => step.competency)).toEqual(['Learning design', 'Inclusive facilitation', 'Activity design', 'Workshop delivery'])
    expect(technical.steps.map((step) => step.competency)).toEqual(['Kubernetes foundations', 'Workloads and configuration', 'Services and networking', 'Node deployment project'])
    expect(workshop.steps.at(-1)?.kind).toBe('produce')
  })

  it('revises constraints and rebinds the generated schedule to the new revision', () => {
    const current = buildRoadmap(defaultGoal, learningCatalog, 1)
    const state: PathwayState = { version: 2, goal: defaultGoal, catalog: learningCatalog, roadmap: current }
    const revised = reviseRoadmap(current, state, { freeOnly: true, preferredFormat: 'guide', reason: 'The learner needs free reading material.' })
    expect(revised.revision).toBe(2)
    expect(revised.revisionId).not.toBe(current.revisionId)
    expect(revised.schedule.roadmapRevisionId).toBe(revised.revisionId)
    expect(revised.steps.every((step) => learningCatalog.find((option) => option.id === step.optionId)?.priceUsd === 0)).toBe(true)
  })

  it('compares and manually replaces only an equivalent resource', () => {
    const current = buildRoadmap(defaultGoal, learningCatalog, 1)
    const step = current.steps.find((item) => item.competency === 'Camera and exposure')!
    const compared = compareLearningOptions(learningCatalog, [step.optionId, 'photo-nikon-exposure'], defaultGoal)
    expect(compared).toHaveLength(2)
    expect(compared[0]).toHaveProperty('sourceConfidence')
    const revised = replaceRoadmapOption(current, learningCatalog, step.id, 'photo-nikon-exposure')
    expect(revised.steps.find((item) => item.id === step.id)?.optionId).toBe('photo-nikon-exposure')
    expect(() => replaceRoadmapOption(current, learningCatalog, step.id, 'photo-adobe-editing')).toThrow(/does not teach/)
  })

  it('keeps approval and saving explicitly human and revision-bound', () => {
    const current = buildRoadmap(defaultGoal, learningCatalog, 1)
    expect(() => saveApprovedRoadmap(current)).toThrow(/Approve the exact/)
    const approved = approveRoadmap(current)
    expect(approved.approvedRevisionId).toBe(current.revisionId)
    expect(saveApprovedRoadmap(approved)).toMatchObject({ status: 'saved', revisionId: current.revisionId })
  })

  it('accepts only an ordered batch of completed steps and replans unfinished work', () => {
    const saved = saveApprovedRoadmap(approveRoadmap(buildRoadmap(defaultGoal, learningCatalog, 1)))
    expect(() => updateLearningProgress(saved, undefined, ['step-2'])).toThrow(/in order/)
    const progress = updateLearningProgress(saved, undefined, ['step-1'])
    const replanned = replanRemainingSchedule(saved, progress, learningCatalog, 2)
    expect(replanned.status).toBe('draft')
    expect(replanned.approvedRevisionId).toBeUndefined()
    expect(replanned.schedule.completedHours).toBe(3)
    expect(replanned.schedule.weeks.filter((week) => week.status === 'upcoming').every((week) => week.hours <= defaultGoal.hoursPerWeek)).toBe(true)
  })

  it('keeps search bounded and domain-filtered', () => {
    const foodResults = searchLearningOptions(learningCatalog, 'food photography lighting', { domain: 'photography', language: 'Spanish', freeOnly: true, limit: 3 })
    expect(foodResults).toHaveLength(3)
    expect(foodResults.every((item) => item.domain === 'photography' && item.priceUsd === 0)).toBe(true)
    expect(searchLearningOptions(learningCatalog, 'Kubernetes', { domain: 'photography', limit: 8 })).toHaveLength(0)
    expect(validateLearningGoal({ ...defaultGoal, weeks: 0, hoursPerWeek: 0 })).toEqual(expect.arrayContaining([expect.stringMatching(/Weeks/), expect.stringMatching(/Hours/)]))
  })

  it('builds only from reviewed resources when a shortlist is provided', () => {
    const reviewedIds = ['photo-adobe-story', 'photo-nikon-exposure', 'photo-adobe-food', 'photo-adobe-editing', 'photo-behance-portfolio']
    const roadmap = buildRoadmap(defaultGoal, learningCatalog, 1, 1, reviewedIds)
    expect(roadmap.steps.every((step) => reviewedIds.includes(step.optionId))).toBe(true)
    expect(roadmap.steps.map((step) => step.optionId)).not.toContain('photo-canon-story-es')
  })

  it('rejects a draft built from an incomplete reviewed shortlist', () => {
    expect(() => buildRoadmap(defaultGoal, learningCatalog, 1, 1, ['photo-canon-story-es'])).toThrow(/every remaining skill/i)
  })

  it('applies budget and per resource time limits during search', () => {
    const results = searchLearningOptions(learningCatalog, 'Kubernetes', { domain: 'kubernetes', budgetUsd: 0, maxHours: 5, limit: 8 })
    expect(results.every((item) => item.priceUsd <= 0 && item.durationHours <= 5)).toBe(true)
    expect(results).not.toContainEqual(expect.objectContaining({ id: 'udemy-k8s-project' }))
  })
})
