import type { ExerciseId } from '../types'

const STORAGE_KEY = 'calisthenics-coach-v2:strength-plan-overrides:v1'

export interface StrengthPlanOverride {
  exerciseId: ExerciseId
  variation: string
  targetReps: number
  sets?: number
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
      ((item as StrengthPlanOverride).sets === undefined || (Number.isFinite((item as StrengthPlanOverride).sets) && Number((item as StrengthPlanOverride).sets) >= 1 && Number((item as StrengthPlanOverride).sets) <= 20)) &&
      Number.isFinite((item as StrengthPlanOverride).addedLoadKg)
    )
  } catch {
    return []
  }
}

export function getStrengthPlanOverride(exerciseId: ExerciseId, variation: string) {
  return readAll().find(item => item.exerciseId === exerciseId && item.variation === variation) ?? null
}

export function saveStrengthPlanOverride(override: StrengthPlanOverride): boolean {
  const current = readAll().filter(item =>
    !(item.exerciseId === override.exerciseId && item.variation === override.variation)
  )
  current.push({ ...override, savedAt: Date.now() })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    return true
  } catch {
    return false
  }
}
export function listStrengthPlanOverrides() {
  return readAll()
}

export function replaceStrengthPlanOverrides(overrides: StrengthPlanOverride[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // Keep the existing local data if the browser storage is full or unavailable.
  }
}
