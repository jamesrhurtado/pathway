import type { LearningGoal, LearningOption, LearningTemplate } from '../types'

export const learningTemplates: LearningTemplate[] = [
  {
    id: 'photography',
    name: 'Commercial photography',
    eyebrow: 'Career transition · 8 weeks',
    description: 'Turn phone-photo and editing experience into a small-business photography portfolio.',
    topic: 'Commercial photography for small businesses',
    defaultOutcome: 'Create a client-ready food photography portfolio and a one-page brief for local restaurants.',
    defaultKnownSkills: ['Basic photo editing', 'Social media content'],
    heroPrompt: 'I manage social media for my family’s café and want to start taking paid food photography work for local restaurants. In 8 weeks, I need a client-ready portfolio. I know basic photo editing, can study 5h/week, have $100, prefer Spanish, and need async resources.',
    stages: [
      { competency: 'Visual storytelling', title: 'See the story before you take the photo', kind: 'learn', deliverable: 'A 12-image visual reference board for one local business' },
      { competency: 'Camera and exposure', title: 'Control light instead of relying on automatic mode', kind: 'practice', deliverable: 'A labeled exposure exercise with 10 food-photo variations' },
      { competency: 'Subject styling and lighting', title: 'Style a subject and shape a simple commercial image', kind: 'practice', deliverable: 'A short shoot plan and three final lighting setups' },
      { competency: 'Editing workflow', title: 'Edit consistently for a client-ready look', kind: 'learn', deliverable: 'A reusable editing preset and before/after contact sheet' },
      { competency: 'Portfolio and client delivery', title: 'Package proof that a small business can hire you', kind: 'produce', deliverable: 'A six-image commercial portfolio story with a one-page client brief' },
    ],
  },
  {
    id: 'facilitation',
    name: 'Inclusive workshop facilitation',
    eyebrow: 'Career transition · 8 weeks',
    description: 'Build the skills and proof to run welcoming, practical sessions for adult learners.',
    topic: 'Inclusive workshop facilitation',
    defaultOutcome: 'Design and deliver a 60-minute inclusive workshop with a reusable facilitation kit.',
    defaultKnownSkills: ['Presentation basics', 'Subject matter knowledge'],
    heroPrompt: 'I have presented before but have never facilitated a workshop. In 8 weeks, I want to run an inclusive 60-minute session. I have 4h/week, a $50 budget, prefer Spanish, and need async material.',
    stages: [
      { competency: 'Learning design', title: 'Turn a topic into a learner-centered session', kind: 'learn', deliverable: 'A one-page learning objective and session outline' },
      { competency: 'Inclusive facilitation', title: 'Plan participation that works for more people', kind: 'practice', deliverable: 'An accessibility and participation checklist' },
      { competency: 'Activity design', title: 'Create practice that gives learners useful feedback', kind: 'practice', deliverable: 'A timed hands-on exercise and facilitator notes' },
      { competency: 'Workshop delivery', title: 'Run a small rehearsal and learn from it', kind: 'produce', deliverable: 'A rehearsal recording and a reflection with three revisions' },
    ],
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes for a Node application',
    eyebrow: 'Technical path · 6 weeks',
    description: 'Use the original technical path when a learner needs to deploy and explain a Node service.',
    topic: 'Kubernetes for a Node application',
    defaultOutcome: 'Deploy a Node application to Kubernetes and explain the deployment choices.',
    defaultKnownSkills: ['JavaScript', 'Node.js', 'Basic Docker'],
    heroPrompt: 'I know Node.js and basic Docker. In 6 weeks, I need to deploy a Node application to Kubernetes. I can study 5h/week, have $150, prefer Spanish, and want async resources.',
    stages: [
      { competency: 'Kubernetes foundations', title: 'Understand the parts of a Kubernetes application', kind: 'learn', deliverable: 'A labeled diagram of a Node app deployment' },
      { competency: 'Workloads and configuration', title: 'Run and configure an application workload', kind: 'practice', deliverable: 'Deployment and ConfigMap manifests in a repository' },
      { competency: 'Services and networking', title: 'Expose the application safely', kind: 'practice', deliverable: 'A service manifest and a short connectivity test' },
      { competency: 'Node deployment project', title: 'Ship one complete Node deployment', kind: 'produce', deliverable: 'A deployed sample app with a setup README' },
    ],
  },
]

export const defaultGoal: LearningGoal = {
  templateId: 'photography',
  topic: 'Food photography for local restaurants',
  outcome: 'Create a client-ready food photography portfolio and a one-page brief for local restaurants.',
  knownSkills: ['Basic photo editing', 'Social media content'],
  weeks: 8,
  hoursPerWeek: 5,
  budgetUsd: 100,
  language: 'Spanish',
  freeOnly: false,
  asyncOnly: true,
  preferredFormat: 'any',
}

const checked = '2026-09-02'
const provider = 'provider page' as const
const curated = 'curated starting point' as const

/**
 * A deterministic, manually-curated catalog snapshot keeps the demo fast and
 * repeatable. Original links are supplied for verification; prices and times
 * are planning estimates, not live provider offers.
 */
export const learningCatalog: LearningOption[] = [
  { id: 'photo-adobe-story', domain: 'photography', title: 'Photography composition and storytelling', provider: 'Adobe', description: 'Practical composition prompts for choosing a subject, framing a scene, and telling a small business story.', url: 'https://www.adobe.com/creativecloud/photography/discover/photography-composition.html', skills: ['Visual storytelling'], prerequisites: [], level: 'beginner', durationHours: 3, priceUsd: 0, languages: ['English'], format: 'guide', availability: 'async', learningOutcome: 'Build a visual reference board and plan a photo story.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Adobe provider page · duration is a Pathway planning estimate.' },
  { id: 'photo-canon-story-es', domain: 'photography', title: 'Consejos de composición fotográfica', provider: 'Canon', description: 'Spanish inspiration and techniques for framing, storytelling, and working with a subject.', url: 'https://www.canon.es/get-inspired/tips-and-techniques/', skills: ['Visual storytelling'], prerequisites: [], level: 'beginner', durationHours: 3, priceUsd: 0, languages: ['Spanish'], format: 'guide', availability: 'async', learningOutcome: 'Build a visual reference board and plan a photo story.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Canon inspiration hub · duration is a Pathway planning estimate.' },
  { id: 'photo-nikon-exposure', domain: 'photography', title: 'Exposure and camera controls', provider: 'Nikon', description: 'A self-paced foundation in aperture, shutter speed, ISO, and making deliberate food-photography choices.', url: 'https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques', skills: ['Camera and exposure'], prerequisites: [], level: 'beginner', durationHours: 5, priceUsd: 0, languages: ['English'], format: 'course', availability: 'async', learningOutcome: 'Make and explain ten exposure variations.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Nikon learning hub · duration is a Pathway planning estimate.' },
  { id: 'photo-canon-exposure-es', domain: 'photography', title: 'Domina la exposición de tu cámara', provider: 'Canon', description: 'A Spanish starting point for moving beyond automatic mode and controlling a photograph deliberately.', url: 'https://www.canon.es/get-inspired/tips-and-techniques/', skills: ['Camera and exposure'], prerequisites: [], level: 'beginner', durationHours: 4, priceUsd: 0, languages: ['Spanish'], format: 'video', availability: 'async', learningOutcome: 'Make and explain ten exposure variations.', lastChecked: checked, sourceConfidence: curated, sourceNote: 'Curated Spanish topic entry point; verify the current lesson selection on Canon.' },
  { id: 'photo-adobe-food', domain: 'photography', title: 'Food photography tips, tricks, and ideas', provider: 'Adobe', description: 'A practical provider guide to planning, styling, lighting, and photographing food before it changes on set.', url: 'https://www.adobe.com/creativecloud/photography/type/food-photography.html', skills: ['Subject styling and lighting'], prerequisites: ['Camera and exposure'], level: 'intermediate', durationHours: 4, priceUsd: 0, languages: ['English'], format: 'guide', availability: 'async', learningOutcome: 'Plan and make three food-photography lighting setups.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Adobe provider guide · duration is a Pathway planning estimate.' },
  { id: 'photo-food-practice-es', domain: 'photography', title: 'Fotografía gastronómica con luz natural: práctica guiada', provider: 'YouTube', description: 'A Spanish search starting point for styling a plate and testing side, back, and window light with limited equipment.', url: 'https://www.youtube.com/results?search_query=fotografia+gastronomica+luz+natural+espanol', skills: ['Subject styling and lighting'], prerequisites: ['Camera and exposure'], level: 'intermediate', durationHours: 4, priceUsd: 0, languages: ['Spanish'], format: 'exercise', availability: 'async', learningOutcome: 'Plan and make three food-photography lighting setups.', lastChecked: checked, sourceConfidence: curated, sourceNote: 'Curated search starting point. External video metadata and results are untrusted.' },
  { id: 'photo-nikon-food', domain: 'photography', title: 'Create your light: food photography at home', provider: 'Nikon', description: 'A provider lesson on natural-light direction, camera settings, styling, and building depth in food images.', url: 'https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/create-your-light-food-photography-at-home', skills: ['Subject styling and lighting'], prerequisites: ['Camera and exposure'], level: 'beginner', durationHours: 3, priceUsd: 0, languages: ['English'], format: 'guide', availability: 'async', learningOutcome: 'Test side and back light, then document a repeatable home setup.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Nikon provider lesson · duration is a Pathway planning estimate.' },
  { id: 'photo-adobe-editing', domain: 'photography', title: 'Photo editing techniques', provider: 'Adobe', description: 'Self-paced guidance for consistent edits, color, cropping, and a repeatable finishing workflow.', url: 'https://www.adobe.com/creativecloud/photography/discover/photo-editing.html', skills: ['Editing workflow'], prerequisites: ['Camera and exposure'], level: 'beginner', durationHours: 5, priceUsd: 0, languages: ['English'], format: 'guide', availability: 'async', learningOutcome: 'Create a reusable editing preset and contact sheet.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Adobe provider page · duration is a Pathway planning estimate.' },
  { id: 'photo-adobe-editing-es', domain: 'photography', title: 'Edición de fotografía para un estilo consistente', provider: 'Adobe', description: 'Spanish Adobe learning entry point for editing, color, crop, and before-and-after comparisons.', url: 'https://www.adobe.com/es/creativecloud/photography.html', skills: ['Editing workflow'], prerequisites: ['Camera and exposure'], level: 'beginner', durationHours: 5, priceUsd: 0, languages: ['Spanish'], format: 'course', availability: 'async', learningOutcome: 'Create a reusable editing preset and contact sheet.', lastChecked: checked, sourceConfidence: curated, sourceNote: 'Curated Spanish provider entry point; verify the currently available lesson.' },
  { id: 'photo-behance-portfolio', domain: 'photography', title: 'Build a portfolio case study', provider: 'Behance', description: 'A project brief for selecting six images, writing context, and presenting a concise client-facing story.', url: 'https://www.behance.net/galleries', skills: ['Portfolio and client delivery'], prerequisites: ['Subject styling and lighting', 'Editing workflow'], level: 'intermediate', durationHours: 6, priceUsd: 0, languages: ['English', 'Spanish'], format: 'project', availability: 'async', learningOutcome: 'Publish a six-image commercial portfolio story and client brief.', lastChecked: checked, sourceConfidence: curated, sourceNote: 'Curated project brief using Behance as a publication reference; no account action is required.' },

  { id: 'fac-openlearn-design', domain: 'facilitation', title: 'Designing learning activities', provider: 'OpenLearn', description: 'A self-paced introduction to learning objectives, practice, feedback, and sequencing a session.', url: 'https://www.open.edu/openlearn/education-development/learning-how-learn/content-section-overview', skills: ['Learning design'], prerequisites: [], level: 'beginner', durationHours: 4, priceUsd: 0, languages: ['English'], format: 'course', availability: 'async', learningOutcome: 'Write a learner-centered session outline.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'OpenLearn provider page · duration is a Pathway planning estimate.' },
  { id: 'fac-unesco-design-es', domain: 'facilitation', title: 'Diseño de experiencias de aprendizaje', provider: 'UNESCO', description: 'Spanish guidance for planning meaningful learning activities and inclusive participation.', url: 'https://www.unesco.org/es/education', skills: ['Learning design'], prerequisites: [], level: 'beginner', durationHours: 4, priceUsd: 0, languages: ['Spanish'], format: 'guide', availability: 'async', learningOutcome: 'Write a learner-centered session outline.', lastChecked: checked, sourceConfidence: curated, sourceNote: 'Curated UNESCO topic entry point; verify the relevant current publication.' },
  { id: 'fac-w3c-inclusive', domain: 'facilitation', title: 'Planning accessible participation', provider: 'W3C', description: 'A practical accessibility reference for making activities, materials, and interaction more inclusive.', url: 'https://www.w3.org/WAI/fundamentals/accessibility-intro/', skills: ['Inclusive facilitation'], prerequisites: [], level: 'beginner', durationHours: 3, priceUsd: 0, languages: ['English'], format: 'guide', availability: 'async', learningOutcome: 'Create an accessibility and participation checklist.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'W3C provider page · duration is a Pathway planning estimate.' },
  { id: 'fac-activity-practice-es', domain: 'facilitation', title: 'Diseña una actividad práctica con retroalimentación', provider: 'YouTube', description: 'A Spanish search starting point for designing clear group exercises and collecting feedback.', url: 'https://www.youtube.com/results?search_query=disenar+actividad+practica+taller+retroalimentacion', skills: ['Activity design'], prerequisites: ['Learning design'], level: 'intermediate', durationHours: 4, priceUsd: 0, languages: ['Spanish'], format: 'exercise', availability: 'async', learningOutcome: 'Build a timed activity and facilitator notes.', lastChecked: checked, sourceConfidence: curated, sourceNote: 'Curated search starting point. External video metadata and results are untrusted.' },
  { id: 'fac-rehearsal-project', domain: 'facilitation', title: 'Run and reflect on a workshop rehearsal', provider: 'Pathway field guide', description: 'A bounded rehearsal project: invite three people, facilitate 20 minutes, collect feedback, then revise.', url: 'https://www.youtube.com/results?search_query=workshop+facilitation+rehearsal+feedback', skills: ['Workshop delivery'], prerequisites: ['Inclusive facilitation', 'Activity design'], level: 'intermediate', durationHours: 5, priceUsd: 0, languages: ['Spanish', 'English'], format: 'project', availability: 'async', learningOutcome: 'Record a rehearsal and document three changes.', lastChecked: checked, sourceConfidence: curated, sourceNote: 'Pathway project brief with a public research link; the learner controls invitations and recording.' },

  { id: 'k8s-basics-es', domain: 'kubernetes', title: 'Aprende los conceptos básicos de Kubernetes', provider: 'Kubernetes', description: 'Official interactive tutorial covering clusters, deployments, scaling, updates, and debugging.', url: 'https://kubernetes.io/es/docs/tutorials/kubernetes-basics/', skills: ['Kubernetes foundations'], prerequisites: ['Containers'], level: 'beginner', durationHours: 4, priceUsd: 0, languages: ['Spanish', 'English'], format: 'guide', availability: 'async', learningOutcome: 'Explain the parts of a Kubernetes application.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Official Kubernetes documentation · duration is a Pathway planning estimate.' },
  { id: 'ms-intro-k8s-es', domain: 'kubernetes', title: 'Introducción a Kubernetes', provider: 'Microsoft Learn', description: 'A concise introduction to Kubernetes architecture, objects, and workload orchestration.', url: 'https://learn.microsoft.com/es-es/training/modules/intro-to-kubernetes/', skills: ['Kubernetes foundations'], prerequisites: ['Containers'], level: 'beginner', durationHours: 2, priceUsd: 0, languages: ['Spanish', 'English'], format: 'course', availability: 'async', learningOutcome: 'Explain the parts of a Kubernetes application.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Microsoft Learn provider page · duration is a Pathway planning estimate.' },
  { id: 'k8s-workloads-es', domain: 'kubernetes', title: 'Ejecutar aplicaciones en Kubernetes', provider: 'Kubernetes', description: 'Official task guides for pods, deployments, configuration, and application workloads.', url: 'https://kubernetes.io/es/docs/tasks/run-application/', skills: ['Workloads and configuration'], prerequisites: ['Kubernetes foundations'], level: 'beginner', durationHours: 6, priceUsd: 0, languages: ['Spanish', 'English'], format: 'guide', availability: 'async', learningOutcome: 'Create a deployment and ConfigMap.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Official Kubernetes documentation · duration is a Pathway planning estimate.' },
  { id: 'ms-aks-workloads', domain: 'kubernetes', title: 'Deploy and manage a containerized application', provider: 'Microsoft Learn', description: 'A guided path for deploying and managing a container workload on Kubernetes.', url: 'https://learn.microsoft.com/en-us/training/paths/intro-to-kubernetes-on-azure/', skills: ['Workloads and configuration'], prerequisites: ['Kubernetes foundations'], level: 'beginner', durationHours: 5, priceUsd: 0, languages: ['English'], format: 'course', availability: 'async', learningOutcome: 'Create a deployment and ConfigMap.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Microsoft Learn provider page · duration is a Pathway planning estimate.' },
  { id: 'k8s-services-es', domain: 'kubernetes', title: 'Conectar aplicaciones con servicios', provider: 'Kubernetes', description: 'Official guides to Kubernetes services, application exposure, and cluster networking.', url: 'https://kubernetes.io/es/docs/concepts/services-networking/service/', skills: ['Services and networking'], prerequisites: ['Workloads and configuration'], level: 'intermediate', durationHours: 4, priceUsd: 0, languages: ['Spanish', 'English'], format: 'guide', availability: 'async', learningOutcome: 'Create and test a service manifest.', lastChecked: checked, sourceConfidence: provider, sourceNote: 'Official Kubernetes documentation · duration is a Pathway planning estimate.' },
  { id: 'k8s-node-project-es', domain: 'kubernetes', title: 'Proyecto: desplegar Node.js en Kubernetes', provider: 'YouTube', description: 'A Spanish starting point covering images, deployments, services, and verification.', url: 'https://www.youtube.com/results?search_query=desplegar+nodejs+en+kubernetes+curso', skills: ['Node deployment project'], prerequisites: ['Workloads and configuration', 'Services and networking'], level: 'intermediate', durationHours: 6, priceUsd: 0, languages: ['Spanish'], format: 'project', availability: 'async', learningOutcome: 'Publish a deployable Node sample with documentation.', lastChecked: checked, sourceConfidence: curated, sourceNote: 'Curated search starting point. External video metadata and results are untrusted.' },
  { id: 'udemy-k8s-project', domain: 'kubernetes', title: 'Kubernetes practice course', provider: 'Udemy', description: 'A paid catalog alternative for learners who prefer guided exercises and a longer project sequence.', url: 'https://www.udemy.com/courses/search/?q=kubernetes%20nodejs', skills: ['Kubernetes foundations', 'Workloads and configuration', 'Services and networking', 'Node deployment project'], prerequisites: ['Containers'], level: 'beginner', durationHours: 18, priceUsd: 79, languages: ['English', 'Spanish'], format: 'course', availability: 'async', learningOutcome: 'Practice the full Node deployment workflow.', lastChecked: checked, sourceConfidence: curated, sourceNote: 'Curated catalog listing; price and availability must be verified on Udemy.' },
]

export function getLearningTemplate(id: LearningGoal['templateId']) {
  return learningTemplates.find((template) => template.id === id)
}

export function goalForTemplate(id: LearningGoal['templateId']): LearningGoal {
  const template = getLearningTemplate(id)!
  return {
    ...defaultGoal,
    templateId: template.id,
    topic: template.topic,
    outcome: template.defaultOutcome,
    knownSkills: [...template.defaultKnownSkills],
    weeks: template.id === 'photography' ? 8 : template.id === 'facilitation' ? 8 : 6,
    hoursPerWeek: template.id === 'photography' ? 5 : template.id === 'facilitation' ? 4 : 5,
    budgetUsd: template.id === 'photography' ? 100 : template.id === 'facilitation' ? 50 : 150,
  }
}
