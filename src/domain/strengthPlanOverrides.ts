import type { ExerciseId } from '../types'

const STORAGE_KEY = 'calisthenics-coach-v2:strength-plan-overrides:v1'

export interface StrengthPlanOverride {
  exerciseId: ExerciseId
  variation: string
  targetReps: number
  addedLoadKg: number
  savedAt: number
}

function readAll(): StrengthPlanOverride[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is StrengthPlanOverride =>
      Boolean(item) && typeof item === 'object' &&
      typeof (item as StrengthPlanOverride).exerciseId === 'string' &&
      typeof (item as StrengthPlanOverride).variation === 'string' &&
      Number.isFinite((item as StrengthPlanOverride).targetReps) &&
      Number.isFinite((item as StrengthPlanOverride).addedLoadKg)
    )
  } catch {
    return []
  }
}

export function getStrengthPlanOverride(exerciseId: ExerciseId, variation: string) {
  return readAll().find(item => item.exerciseId === exerciseId && item.variation === variation) ?? null
}

export function saveStrengthPlanOverride(override: StrengthPlanOverride) {
  const current = readAll().filter(item =>
    !(item.exerciseId === override.exerciseId && item.variation === override.variation)
  )
  current.push({ ...override, savedAt: Date.now() })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // The current workout can still be logged if localStorage is unavailable.
  }
}
