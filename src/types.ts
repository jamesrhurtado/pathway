export type LearningDomain = 'photography' | 'facilitation' | 'kubernetes'
export type LearningStageKind = 'learn' | 'practice' | 'produce'
export type ResourceFormat = 'course' | 'guide' | 'exercise' | 'assessment' | 'project' | 'video'
export type LearningLevel = 'beginner' | 'intermediate' | 'advanced'
export type RoadmapStatus = 'draft' | 'approved' | 'saved'
export type SourceConfidence = 'provider page' | 'curated starting point'

export interface LearningTemplateStage {
  competency: string
  title: string
  kind: LearningStageKind
  deliverable: string
}

export interface LearningTemplate {
  id: LearningDomain
  name: string
  eyebrow: string
  description: string
  topic: string
  defaultOutcome: string
  defaultKnownSkills: string[]
  heroPrompt: string
  stages: LearningTemplateStage[]
}

export interface LearningOption {
  id: string
  domain: LearningDomain
  title: string
  provider: string
  description: string
  url: string
  skills: string[]
  prerequisites: string[]
  level: LearningLevel
  durationHours: number
  priceUsd: number
  languages: string[]
  format: ResourceFormat
  availability: 'async' | 'mixed'
  learningOutcome: string
  lastChecked: string
  sourceConfidence: SourceConfidence
  sourceNote: string
}

export interface LearningGoal {
  templateId: LearningDomain
  topic: string
  outcome: string
  knownSkills: string[]
  weeks: number
  hoursPerWeek: number
  budgetUsd: number
  language: string
  freeOnly: boolean
  asyncOnly: boolean
  preferredFormat: 'any' | ResourceFormat
}

export interface LearningDiscovery {
  brief: string
  query: string
  templateId: LearningDomain
  resultIds: string[]
  updatedAt: string
}

export interface SkillGapSummary {
  known: string[]
  needed: string[]
  skipped: string[]
}

export interface RoadmapStep {
  id: string
  order: number
  competency: string
  title: string
  kind: LearningStageKind
  deliverable: string
  optionId: string
  alternativeIds: string[]
  reason: string
}

export interface RoadmapTotals {
  hours: number
  costUsd: number
  weeklyHours: number
  weeks: number
  withinTime: boolean
  withinBudget: boolean
  preferredLanguageCount: number
  asyncCount: number
}

export interface WeeklyStudyBlock {
  stepId: string
  optionId: string
  title: string
  competency: string
  hours: number
  completesStep: boolean
}

export interface ScheduleWeek {
  week: number
  hours: number
  blocks: WeeklyStudyBlock[]
  milestone: string
  status?: 'completed' | 'upcoming'
}

export interface WeeklySchedule {
  roadmapRevisionId: string
  totalHours: number
  weeks: ScheduleWeek[]
  completedHours?: number
  remainingHours?: number
  replannedAt?: string
}

export interface LearningProgress {
  roadmapId: string
  completedStepIds: string[]
  updatedAt: string
}

export interface Roadmap {
  id: string
  status: RoadmapStatus
  revision: number
  revisionId: string
  stateVersion: number
  goal: LearningGoal
  skillGap: SkillGapSummary
  steps: RoadmapStep[]
  totals: RoadmapTotals
  warnings: string[]
  createdAt: string
  schedule: WeeklySchedule
  approvedRevisionId?: string
  savedAt?: string
}

export interface PathwayState {
  version: number
  goal: LearningGoal
  catalog: LearningOption[]
  discovery?: LearningDiscovery
  roadmap?: Roadmap
  progress?: LearningProgress
}

export interface RoadmapRevisionInput {
  knownSkills?: string[]
  weeks?: number
  hoursPerWeek?: number
  budgetUsd?: number
  language?: string
  freeOnly?: boolean
  asyncOnly?: boolean
  preferredFormat?: LearningGoal['preferredFormat']
  reason: string
}

export interface ToolTraceEntry {
  id: string
  time: string
  name: string
  input: unknown
  result: unknown
  status: 'success' | 'error'
}
