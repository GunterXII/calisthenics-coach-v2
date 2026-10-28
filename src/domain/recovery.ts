import type { ExerciseId, WorkoutLog } from '../types'

export interface RecoveryAlert {
  id: string
  title: string
  detail: string
}

function sessionReps(workout: WorkoutLog, exerciseId: ExerciseId, variation: string, addedLoadKg: number) {
  return workout.setLogs
    .filter(set => set.exerciseId === exerciseId && set.variation === variation && set.addedLoadKg === addedLoadKg && set.completed)
    .reduce((sum, set) => sum + set.actualReps, 0)
}

export function getRecoveryAlerts(workouts: WorkoutLog[]): RecoveryAlert[] {
  const ordered = [...workouts].sort((a, b) =>
    (b.completedAt ?? new Date(b.date).getTime()) - (a.completedAt ?? new Date(a.date).getTime())
  )
  const alerts: RecoveryAlert[] = []
  const latest = ordered[0]

  if (!latest) return alerts

  const painReported = Boolean(latest.pain.trim()) ||
    latest.setLogs.some(set => set.technique === 'pain') ||
    latest.emomLogs.some(emom => emom.technique === 'pain')
  if (painReported) {
    alerts.push({
      id: 'pain',
      title: 'Dolore registrato',
      detail: 'Non aumentare carico o volume sull’area interessata. Valuta di interrompere i movimenti dolorosi e di riprendere solo quando è appropriato.',
    })
  }

  if (latest.sleepHours !== null && latest.sleepHours < 6) {
    alerts.push({
      id: 'sleep',
      title: 'Sonno ridotto',
      detail: 'Hai registrato meno di 6 ore di sonno nell’ultima seduta: considera un allenamento più leggero e valuta come ti senti durante il riscaldamento.',
    })
  }

  if (latest.fatigue !== null && latest.fatigue >= 8) {
    alerts.push({
      id: 'fatigue',
      title: 'Fatica percepita elevata',
      detail: 'Hai registrato fatica 8/10 o superiore: valuta di ridurre temporaneamente il volume del 20–30% e non forzare le serie se la tecnica peggiora.',
    })
  }

  const keys = new Set<string>()
  for (const workout of ordered.slice(0, 8)) {
    for (const set of workout.setLogs) {
      if (set.completed) keys.add(set.exerciseId + '::' + set.variation + '::' + set.addedLoadKg)
    }
  }

  let decliningKey: string | null = null
  for (const key of keys) {
    const [exercise, ...parts] = key.split('::')
    const addedLoadKg = Number(parts.pop())
    const variation = parts.join('::')
    const sessions = ordered
      .filter(workout => workout.setLogs.some(set => set.exerciseId === exercise as ExerciseId && set.variation === variation && set.addedLoadKg === addedLoadKg && set.completed))
      .slice(0, 3)
    if (sessions.length !== 3) continue
    const values = sessions.map(workout => sessionReps(workout, exercise as ExerciseId, variation, addedLoadKg))
    if (values[0] < values[1] && values[1] < values[2]) {
      decliningKey = key
      break
    }
  }

  if (decliningKey) {
    alerts.push({
      id: 'decline',
      title: 'Prestazioni in calo per 2 sedute consecutive',
      detail: 'Il volume completato è diminuito in due sessioni consecutive per lo stesso esercizio/variante. Valuta un taglio temporaneo del volume del 20–30%; il programma non viene modificato automaticamente.',
    })
  }

  return alerts
}
