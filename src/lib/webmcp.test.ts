import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultGoal, learningCatalog } from '../data/catalog'
import type { PathwayBridgeActions } from './webmcp'
import { approveRoadmap, buildRoadmap, saveApprovedRoadmap } from './pathwayEngine'
import { registerPathwayTools } from './webmcp'

const registrations: ModelContextTool[] = []

function actions(overrides: Partial<PathwayBridgeActions> = {}): PathwayBridgeActions {
  return {
    state: { version: 1, goal: defaultGoal, catalog: learningCatalog },
    prepareDiscovery: vi.fn(), build: vi.fn(), revise: vi.fn(), updateProgress: vi.fn(), replan: vi.fn(),
    ...overrides,
  }
}

afterEach(() => {
  registrations.length = 0
  vi.unstubAllGlobals()
})

function installDocument() {
  vi.stubGlobal('document', { modelContext: { registerTool: (tool: ModelContextTool) => { registrations.push(tool) } } })
}

describe('Pathway WebMCP tools', () => {
  it('exposes a focused contract for each workflow state', async () => {
    installDocument()
    let result = registerPathwayTools(actions())
    expect(result.names).toEqual(expect.arrayContaining(['get_learning_context', 'prepare_learning_search', 'search_learning_resources', 'inspect_learning_resource', 'compare_learning_resources']))
    expect(result.names).not.toContain('build_learning_path')
    expect(result.names).not.toContain('revise_learning_path')
    result.cleanup()

    registrations.length = 0
    const searchReady = { brief: 'I want to build a food photography portfolio.', query: 'photography lighting editing portfolio', templateId: 'photography' as const, resultIds: ['photo-canon-story-es'], updatedAt: '2026-09-02T12:00:00.000Z' }
    const draft = buildRoadmap(defaultGoal, learningCatalog, 1)
    const build = vi.fn()
    result = registerPathwayTools(actions({ state: { version: 1, goal: defaultGoal, catalog: learningCatalog, discovery: searchReady }, build }))
    expect(result.names).toContain('build_learning_path')
    const buildTool = registrations.find((tool) => tool.name === 'build_learning_path')!
    await buildTool.execute({ resourceIds: ['photo-canon-story-es'], preferredResourceIds: ['photo-canon-story-es'] })
    expect(build).toHaveBeenCalledWith(defaultGoal, ['photo-canon-story-es'], ['photo-canon-story-es'])
    result.cleanup()

    registrations.length = 0
    result = registerPathwayTools(actions({ state: { version: 1, goal: defaultGoal, catalog: learningCatalog, roadmap: draft } }))
    expect(result.names).toContain('revise_learning_path')
    expect(result.names).not.toContain('build_learning_path')
    expect(result.names).not.toContain('update_learning_progress')
    result.cleanup()

    registrations.length = 0
    const saved = saveApprovedRoadmap(approveRoadmap(draft))
    result = registerPathwayTools(actions({ state: { version: 2, goal: defaultGoal, catalog: learningCatalog, roadmap: saved } }))
    expect(result.names).toContain('update_learning_progress')
    expect(result.names).not.toContain('replan_remaining_path')
    result.cleanup()

    registrations.length = 0
    result = registerPathwayTools(actions({ state: { version: 2, goal: defaultGoal, catalog: learningCatalog, roadmap: saved, progress: { roadmapId: saved.id, completedStepIds: ['step-1'], updatedAt: '2026-08-31T12:00:00.000Z' } } }))
    expect(result.names).toEqual(expect.arrayContaining(['update_learning_progress', 'replan_remaining_path']))
  })

  it('marks source catalog reads as untrusted and keeps schemas bounded', () => {
    installDocument()
    registerPathwayTools(actions())
    const search = registrations.find((tool) => tool.name === 'search_learning_resources')!
    expect(search.annotations).toMatchObject({ readOnlyHint: true, untrustedContentHint: true })
    expect(JSON.stringify(search.inputSchema)).toContain('maximum')
    for (const tool of registrations) {
      expect(tool.name.length).toBeLessThanOrEqual(32)
      expect(tool.description.length).toBeLessThanOrEqual(500)
    }
  })

  it('returns recovery guidance for an invalid exact id', async () => {
    installDocument()
    registerPathwayTools(actions())
    const inspect = registrations.find((tool) => tool.name === 'inspect_learning_resource')!
    await expect(inspect.execute({ resourceId: 'not-real' })).resolves.toMatchObject({ ok: false, recovery: expect.stringMatching(/exact returned id/) })
  })

  it('starts without inventing a learner goal and can search across catalog domains', async () => {
    installDocument()
    const blankGoal = { ...defaultGoal, topic: '', outcome: '', knownSkills: [] }
    registerPathwayTools(actions({ state: { version: 1, goal: blankGoal, catalog: learningCatalog } }))
    const context = registrations.find((tool) => tool.name === 'get_learning_context')!
    const search = registrations.find((tool) => tool.name === 'search_learning_resources')!
    await expect(context.execute({})).resolves.toMatchObject({ ok: true, firstRun: true, goal: null })
    await expect(search.execute({ query: 'Kubernetes services', limit: 3 })).resolves.toMatchObject({
      ok: true,
      results: expect.arrayContaining([expect.objectContaining({ id: 'k8s-services-es' })]),
    })
    await expect(search.execute({ query: 'Kubernetes', limit: 8 })).resolves.toMatchObject({
      ok: true,
      results: expect.arrayContaining([expect.objectContaining({ id: 'udemy-k8s-project' })]),
    })
  })

  it('compares resources without changing state and records both outcomes', async () => {
    installDocument()
    const recordTool = vi.fn()
    const showComparison = vi.fn()
    const showResourceDetails = vi.fn()
    registerPathwayTools(actions({ recordTool, showComparison, showResourceDetails }))
    const compare = registrations.find((tool) => tool.name === 'compare_learning_resources')!
    const inspect = registrations.find((tool) => tool.name === 'inspect_learning_resource')!
    await expect(compare.execute({ resourceIds: ['photo-canon-exposure-es', 'photo-nikon-exposure'] })).resolves.toMatchObject({ ok: true, resources: expect.any(Array) })
    expect(showComparison).toHaveBeenCalledWith(['photo-canon-exposure-es', 'photo-nikon-exposure'])
    await expect(inspect.execute({ resourceId: 'photo-canon-exposure-es' })).resolves.toMatchObject({ ok: true, visible: expect.stringMatching(/details panel/) })
    expect(showResourceDetails).toHaveBeenCalledWith('photo-canon-exposure-es')
    await inspect.execute({ resourceId: 'not-real' })
    expect(recordTool).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'compare_learning_resources', status: 'success' }))
    expect(recordTool).toHaveBeenNthCalledWith(3, expect.objectContaining({ name: 'inspect_learning_resource', status: 'error' }))
  })
})
