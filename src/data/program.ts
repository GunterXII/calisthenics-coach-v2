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

export interface Prescription {
  exerciseId: ExerciseId
  title: string
  sets?: number
  reps?: number
  durationMinutes?: number
  repsPerMinute?: number
  addedLoadKg: number
  variation: string
  optional?: boolean
  notes?: string
  pairedWith?: ExerciseId
}

export interface TrainingDay {
  id: string
  label: string
  focus: string
  prescriptions: Prescription[]
}

export type CycleWeek = 1 | 2 | 3 | 4

export const TRAINING_WEEK: TrainingDay[] = [
  { id: 'mon', label: 'Lunedì', focus: 'Recupero', prescriptions: [] },
  {
      id: 'tue', label: 'Martedì', focus: 'Trazione e forza',
      prescriptions: [
        { exerciseId: 'pull-up', title: 'Pull-up EMOM', durationMinutes: 10, repsPerMinute: 6, addedLoadKg: 0, variation: 'Strict', notes: '10 minuti a corpo libero. Aumenta a 7 rep/min solo dopo sessioni pulite.' },
        { exerciseId: 'pull-up', title: 'Pull-up zavorrati · top set', sets: 1, reps: 5, addedLoadKg: 25, variation: 'Strict · top set', notes: '1×5 @25 kg; lascia almeno 1–2 RIR.' },
        { exerciseId: 'pull-up', title: 'Pull-up zavorrati · back-off', sets: 2, reps: 6, addedLoadKg: 20, variation: 'Strict · back-off', notes: '2×6–8 @20 kg.' },
        { exerciseId: 'pull-up', title: 'Drop set pull-up', sets: 1, reps: 1, addedLoadKg: 0, variation: 'Drop set', optional: true, notes: 'Facoltativo ogni due settimane: una serie controllata dopo aver tolto la zavorra; non arrivare a cedimento tecnico.' },
        { exerciseId: 'chin-up', title: 'Chin-up zavorrati', sets: 3, reps: 8, addedLoadKg: 10, variation: 'Supina', notes: '3×8–10 @10–15 kg.' },
      ],
    },
  {
      id: 'wed', label: 'Mercoledì', focus: 'Spinta e ipertrofia',
      prescriptions: [
        { exerciseId: 'dip', title: 'Dip zavorrati · volume', sets: 10, reps: 6, addedLoadKg: 5, variation: 'Parallele', notes: '10 serie ×6–8 ripetizioni @5 kg. Recupera 3 minuti tra ogni serie; aumenta le ripetizioni solo mantenendo tecnica e margine.' },
        { exerciseId: 'dip', title: 'Dip zavorrati · top set', sets: 1, reps: 8, addedLoadKg: 25, variation: 'Parallele · top set', notes: '1×8–10 @25–30 kg.' },
        { exerciseId: 'dip', title: 'Dip zavorrati · back-off', sets: 2, reps: 10, addedLoadKg: 20, variation: 'Parallele · back-off', notes: '2×10–12 @20 kg.' },
        { exerciseId: 'dip', title: 'Drop set dip', sets: 1, reps: 1, addedLoadKg: 0, variation: 'Drop set', optional: true, notes: 'Facoltativo ogni due settimane, solo se spalle e gomiti sono senza fastidi.' },
        { exerciseId: 'push-up', title: 'Push-up zavorrati', sets: 3, reps: 12, addedLoadKg: 15, variation: 'Strict · superset', pairedWith: 'diamond-push-up', notes: '3–4 round ×12–15 @15–20 kg; alterna con diamond push-up.' },
        { exerciseId: 'diamond-push-up', title: 'Diamond push-up', sets: 3, reps: 8, addedLoadKg: 0, variation: 'Strict · superset', pairedWith: 'push-up', notes: '8–10 ripetizioni a corpo libero dopo i push-up zavorrati.' },
      ],
    },
  { id: 'thu', label: 'Giovedì', focus: 'Recupero', prescriptions: [] },
  {
      id: 'fri', label: 'Venerdì', focus: 'Muscle-up e potenza',
      prescriptions: [
        { exerciseId: 'muscle-up', title: 'Muscle-up + straight-bar dip', sets: 4, reps: 1, addedLoadKg: 0, variation: 'Quality complex', pairedWith: 'straight-bar-dip', notes: '4 round: 1 muscle-up + 6–8 straight-bar dip; riposa 2–3 minuti.' },
        { exerciseId: 'straight-bar-dip', title: 'Straight-bar dip · complex', sets: 4, reps: 6, addedLoadKg: 0, variation: 'Quality complex', pairedWith: 'muscle-up', notes: '6–8 ripetizioni dopo ogni muscle-up del complex.' },
        { exerciseId: 'muscle-up', title: 'Muscle-up EMOM', durationMinutes: 8, repsPerMinute: 2, addedLoadKg: 0, variation: 'Strict', notes: '8×2; passa a 3 solo se tutte le ripetizioni sono pulite e veloci.' },
        { exerciseId: 'explosive-pull-up', title: 'Trazioni esplosive', sets: 3, reps: 4, addedLoadKg: 0, variation: 'Esplosive', notes: '3–4×4–5 a corpo libero; interrompi il set se perdi esplosività.' },
        { exerciseId: 'push-up', title: 'Push-up EMOM zavorrati', durationMinutes: 10, repsPerMinute: 10, addedLoadKg: 5, variation: 'Strict', notes: '10×10–12 @5 kg. Se il venerdì peggiora, riduci a 6–8 minuti.' },
      ],
    },
  {
      id: 'sat', label: 'Sabato', focus: 'Ipertrofia zavorrata',
      prescriptions: [
        { exerciseId: 'pull-up', title: 'Pull-up presa stretta', sets: 4, reps: 6, addedLoadKg: 20, variation: 'Presa stretta', notes: '4×6–8 @20 kg.' },
        { exerciseId: 'dip', title: 'Dip con fermo', sets: 3, reps: 8, addedLoadKg: 15, variation: 'Fermo in basso', notes: '3–4×8–10 @15–20 kg; fermo controllato in basso.' },
        { exerciseId: 'push-up', title: 'Push-up zavorrati', sets: 3, reps: 12, addedLoadKg: 15, variation: 'Strict · venerdì', notes: '3×12–15 @15–20 kg.' },
      ],
    },
  {
      id: 'sun', label: 'Domenica', focus: 'Circuito tecnico',
      prescriptions: [
        { exerciseId: 'muscle-up', title: 'Circuito full body', sets: 3, reps: 3, addedLoadKg: 0, variation: 'Circuito', notes: 'Ogni round: 3 muscle-up, 8 pull-up, 15 dip, 20 push-up. Recupera 3 minuti; 3–4 round, fino a 5 solo se le reps restano pulite.' },
        { exerciseId: 'pull-up', title: 'Circuito · pull-up', sets: 3, reps: 8, addedLoadKg: 0, variation: 'Circuito', notes: '8 pull-up a round; 3 minuti di recupero tra i round.' },
        { exerciseId: 'dip', title: 'Circuito · dip', sets: 3, reps: 15, addedLoadKg: 0, variation: 'Circuito', notes: '15 dip a round; mantieni la tecnica.' },
        { exerciseId: 'push-up', title: 'Circuito · push-up', sets: 3, reps: 20, addedLoadKg: 0, variation: 'Circuito', notes: '20 push-up a round; termina prima del cedimento tecnico.' },
      ],
    }
]

export function prescriptionForWeek(p: Prescription, week: CycleWeek): Prescription {
  if (week !== 4) return { ...p }
  return {
    ...p,
    addedLoadKg: p.addedLoadKg >= 20 ? p.addedLoadKg - 5 : p.addedLoadKg,
    sets: p.sets === undefined ? undefined : p.sets <= 1 ? 1 : p.sets === 2 ? 1 : p.sets === 3 ? 2 : Math.max(1, Math.floor(p.sets * 0.6)),
    durationMinutes: p.durationMinutes === undefined ? undefined : Math.max(1, Math.ceil(p.durationMinutes * 0.6)),
  }
}

export function prescriptionSummary(p: Prescription, week: CycleWeek = 1) {
  const scaled = prescriptionForWeek(p, week)
  if (scaled.durationMinutes !== undefined) return String(scaled.durationMinutes) + ' min × ' + scaled.repsPerMinute + ' rep/min · ' + scaled.addedLoadKg + ' kg'
  return String(scaled.sets) + ' serie × ' + scaled.reps + ' rep · ' + scaled.addedLoadKg + ' kg'
}

export function prescriptionNotes(p: Prescription, week: CycleWeek) {
  if (week !== 4) return p.notes ?? ''
  return [p.notes, 'DELOAD: volume ridotto del 40%; niente cedimento, drop set o massimali.'].filter(Boolean).join(' ')
}
