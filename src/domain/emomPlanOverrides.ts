import type { ExerciseId } from '../types'

const STORAGE_KEY = 'calisthenics-coach-v2:emom-plan-overrides:v1'

export interface EmomPlanOverride {
  exerciseId: ExerciseId
  variation: string
  duration: number
  repsPerMinute: number
  load: number
  savedAt: number
}

function readAll(): EmomPlanOverride[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is EmomPlanOverride =>
      Boolean(item) && typeof item === 'object' &&
      typeof (item as EmomPlanOverride).exerciseId === 'string' &&
      typeof (item as EmomPlanOverride).variation === 'string' &&
      Number.isFinite((item as EmomPlanOverride).duration) &&
      Number.isFinite((item as EmomPlanOverride).repsPerMinute) &&
      Number.isFinite((item as EmomPlanOverride).load)
    )
  } catch {
    return []
  }
}

export function getEmomPlanOverride(exerciseId: ExerciseId, variation: string) {
  return readAll().find(item => item.exerciseId === exerciseId && item.variation === variation) ?? null
}

export function saveEmomPlanOverride(override: EmomPlanOverride) {
  const current = readAll().filter(item =>
    !(item.exerciseId === override.exerciseId && item.variation === override.variation)
  )
  current.push({ ...override, savedAt: Date.now() })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // EMOM registration still works if localStorage is unavailable.
  }
}
