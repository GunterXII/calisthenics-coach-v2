import type { Exercise, ExerciseId } from '../types'
export const PLATES_KG = [10, 10, 5, 5] as const
export const VALID_LOADS_KG = [0, 5, 10, 15, 20, 25, 30] as const
export const EXERCISES: Exercise[] = [
  { id: 'pull-up', name: 'Pull-up', category: 'pull', unit: 'reps' },
  { id: 'chin-up', name: 'Chin-up', category: 'pull', unit: 'reps' },
  { id: 'dip', name: 'Dip', category: 'push', unit: 'reps' },
  { id: 'push-up', name: 'Push-up', category: 'push', unit: 'reps' },
  { id: 'diamond-push-up', name: 'Diamond push-up', category: 'push', unit: 'reps' },
  { id: 'muscle-up', name: 'Muscle-up', category: 'skill', unit: 'reps' },
  { id: 'straight-bar-dip', name: 'Straight-bar dip', category: 'push', unit: 'reps' },
  { id: 'explosive-pull-up', name: 'Explosive pull-up', category: 'pull', unit: 'reps' },
]
export interface Prescription { exerciseId: ExerciseId; title: string; sets?: number; reps?: number; durationMinutes?: number; repsPerMinute?: number; addedLoadKg: number; variation: string; optional?: boolean }
export interface TrainingDay { id: string; label: string; focus: string; prescriptions: Prescription[] }
export const TRAINING_WEEK: TrainingDay[] = [
  { id: 'mon', label: 'Lunedì', focus: 'Trazione e forza', prescriptions: [
    { exerciseId: 'pull-up', title: 'Pull-up EMOM', durationMinutes: 10, repsPerMinute: 6, addedLoadKg: 0, variation: 'Strict' },
    { exerciseId: 'pull-up', title: 'Pull-up zavorrati', sets: 3, reps: 6, addedLoadKg: 20, variation: 'Strict · top set 25 kg × 5' },
    { exerciseId: 'chin-up', title: 'Chin-up zavorrati', sets: 3, reps: 8, addedLoadKg: 10, variation: 'Supina' },
  ]},
  { id: 'tue', label: 'Martedì', focus: 'Spinta e ipertrofia', prescriptions: [
    { exerciseId: 'dip', title: 'Dip EMOM', durationMinutes: 10, repsPerMinute: 6, addedLoadKg: 5, variation: 'Parallele' },
    { exerciseId: 'dip', title: 'Dip zavorrati', sets: 3, reps: 10, addedLoadKg: 20, variation: 'Parallele · top set 25–30 kg' },
    { exerciseId: 'push-up', title: 'Push-up zavorrati', sets: 3, reps: 12, addedLoadKg: 15, variation: 'Superset diamond push-up' },
  ]},
  { id: 'wed', label: 'Mercoledì', focus: 'Recupero', prescriptions: [] },
  { id: 'thu', label: 'Giovedì', focus: 'Muscle-up e potenza', prescriptions: [
    { exerciseId: 'muscle-up', title: 'Muscle-up EMOM', durationMinutes: 8, repsPerMinute: 2, addedLoadKg: 0, variation: 'Strict · 3 solo se puliti' },
    { exerciseId: 'explosive-pull-up', title: 'Trazioni esplosive', sets: 4, reps: 4, addedLoadKg: 0, variation: 'Esplosive' },
    { exerciseId: 'push-up', title: 'Push-up EMOM', durationMinutes: 10, repsPerMinute: 10, addedLoadKg: 5, variation: 'Strict' },
  ]},
  { id: 'fri', label: 'Venerdì', focus: 'Ipertrofia zavorrata', prescriptions: [
    { exerciseId: 'pull-up', title: 'Pull-up presa stretta', sets: 4, reps: 6, addedLoadKg: 20, variation: 'Presa stretta' },
    { exerciseId: 'dip', title: 'Dip con fermo', sets: 4, reps: 8, addedLoadKg: 15, variation: 'Fermo in basso' },
    { exerciseId: 'push-up', title: 'Push-up zavorrati', sets: 3, reps: 12, addedLoadKg: 15, variation: 'Strict' },
  ]},
  { id: 'sat', label: 'Sabato', focus: 'Circuito', prescriptions: [
    { exerciseId: 'muscle-up', title: 'Circuito muscle-up', sets: 3, reps: 3, addedLoadKg: 0, variation: '3 MU + 8 pull-up + 15 dip + 20 push-up' },
  ]},
  { id: 'sun', label: 'Domenica', focus: 'Recupero', prescriptions: [] },
]
