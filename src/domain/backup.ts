import { db } from '../database/db'
import type { EmomLog, PersonalRecord, WorkoutLog, ExerciseId } from '../types'
import { listStrengthPlanOverrides, replaceStrengthPlanOverrides, type StrengthPlanOverride } from './strengthPlanOverrides'
import { listEmomPlanOverrides, replaceEmomPlanOverrides, type EmomPlanOverride } from './emomPlanOverrides'

export interface CoachBackup {
  app: 'calisthenics-coach-v2'
  schemaVersion: 2
  exportedAt: string
  data: { workouts: WorkoutLog[]; emoms: EmomLog[]; records: PersonalRecord[] }
  settings: {
    strengthPlanOverrides: StrengthPlanOverride[]
    emomPlanOverrides: EmomPlanOverride[]
    cycleWeek: 1 | 2 | 3 | 4
  }
}
export async function createBackup(): Promise<CoachBackup> {
  const [workouts, emoms, records] = await db.transaction('r', db.workouts, db.emoms, db.records, async () => Promise.all([
    db.workouts.toArray(), db.emoms.toArray(), db.records.toArray(),
  ]))
  let cycleWeek: 1 | 2 | 3 | 4 = 1
  try {
    const value = Number(localStorage.getItem('calisthenics-coach-v2:cycle-week'))
    if ([1, 2, 3, 4].includes(value)) cycleWeek = value as 1 | 2 | 3 | 4
  } catch {}
  return {
    app: 'calisthenics-coach-v2',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    data: { workouts, emoms, records },
    settings: {
      strengthPlanOverrides: listStrengthPlanOverrides(),
      emomPlanOverrides: listEmomPlanOverrides(),
      cycleWeek,
    },
  }
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function hasId(value: unknown): value is { id: string } {
  return isObject(value) && typeof value.id === 'string' && value.id.length > 0
}
function isExerciseId(value: unknown): value is ExerciseId {
  return ['pull-up', 'chin-up', 'dip', 'push-up', 'diamond-push-up', 'muscle-up', 'straight-bar-dip', 'explosive-pull-up'].includes(String(value))
}
function isStrengthOverride(value: unknown): value is StrengthPlanOverride {
  return isObject(value) && isExerciseId(value.exerciseId) && typeof value.variation === 'string' &&
    Number.isFinite(value.targetReps) && Number(value.targetReps) >= 1 &&
    (value.sets === undefined || (Number.isFinite(value.sets) && Number(value.sets) >= 1 && Number(value.sets) <= 20)) &&
    [0, 5, 10, 15, 20, 25, 30].includes(Number(value.addedLoadKg)) &&
    Number.isFinite(value.savedAt)
}
function isEmomOverride(value: unknown): value is EmomPlanOverride {
  return isObject(value) && isExerciseId(value.exerciseId) && typeof value.variation === 'string' &&
    Number.isFinite(value.duration) && Number(value.duration) >= 1 && Number(value.duration) <= 60 &&
    Number.isFinite(value.repsPerMinute) && Number(value.repsPerMinute) >= 1 && Number(value.repsPerMinute) <= 100 &&
    [0, 5, 10, 15, 20, 25, 30].includes(Number(value.load)) && Number.isFinite(value.savedAt)
}
export function parseBackup(value: unknown): CoachBackup {
  if (!isObject(value) || value.app !== 'calisthenics-coach-v2' ||
      (value.schemaVersion !== 1 && value.schemaVersion !== 2) || !isObject(value.data)) {
    throw new Error('File non riconosciuto o versione del backup non supportata.')
  }
  if (typeof value.exportedAt !== 'string') throw new Error('Il backup non contiene una data di esportazione valida.')
  const { workouts, emoms, records } = value.data
  if (!Array.isArray(workouts) || !Array.isArray(emoms) || !Array.isArray(records)) {
    throw new Error('Il backup è incompleto: mancano una o più raccolte.')
  }
  if (![...workouts, ...emoms, ...records].every(hasId)) {
    throw new Error('Il backup contiene record senza identificativo valido.')
  }
  const ids = (rows: unknown[]) => new Set(rows.map(row => (row as {id:string}).id)).size === rows.length
  if (!ids(workouts) || !ids(emoms) || !ids(records)) throw new Error('Il backup contiene identificativi duplicati.')
  for (const w of workouts) {
    if (!isObject(w) || typeof w.date !== 'string' || !Array.isArray(w.setLogs) || !Array.isArray(w.emomLogs)) throw new Error('Una sessione di allenamento non è valida.')
  }
  for (const e of emoms) {
    if (!isObject(e) || !Array.isArray(e.minutes) || typeof e.exerciseId !== 'string') throw new Error('Una registrazione EMOM non è valida.')
  }
  for (const r of records) {
    if (!isObject(r) || typeof r.exerciseId !== 'string' || typeof r.reps !== 'number' || typeof r.testedAt !== 'number') throw new Error('Un record personale non è valido.')
  }

  let strengthPlanOverrides: StrengthPlanOverride[] = []
  let emomPlanOverrides: EmomPlanOverride[] = []
  let cycleWeek: 1 | 2 | 3 | 4 = 1
  if (value.schemaVersion === 2) {
    if (!isObject(value.settings) || !Array.isArray(value.settings.strengthPlanOverrides) ||
        !Array.isArray(value.settings.emomPlanOverrides) || ![1, 2, 3, 4].includes(Number(value.settings.cycleWeek))) {
      throw new Error('Le impostazioni del backup non sono valide.')
    }
    if (!value.settings.strengthPlanOverrides.every(isStrengthOverride) ||
        !value.settings.emomPlanOverrides.every(isEmomOverride)) {
      throw new Error('Il backup contiene progressioni personalizzate non valide.')
    }
    strengthPlanOverrides = value.settings.strengthPlanOverrides
    emomPlanOverrides = value.settings.emomPlanOverrides
    cycleWeek = Number(value.settings.cycleWeek) as 1 | 2 | 3 | 4
  }
  return {
    app: 'calisthenics-coach-v2',
    schemaVersion: 2,
    exportedAt: value.exportedAt,
    data: {
      workouts: workouts as WorkoutLog[],
      emoms: emoms as EmomLog[],
      records: records as PersonalRecord[],
    },
    settings: { strengthPlanOverrides, emomPlanOverrides, cycleWeek },
  }
}
export async function restoreBackup(backup: CoachBackup): Promise<void> {
  await db.transaction('rw', db.workouts, db.emoms, db.records, async () => {
    await Promise.all([db.workouts.clear(), db.emoms.clear(), db.records.clear()])
    await Promise.all([
      db.workouts.bulkAdd(backup.data.workouts),
      db.emoms.bulkAdd(backup.data.emoms),
      db.records.bulkAdd(backup.data.records),
    ])
  })
  replaceStrengthPlanOverrides(backup.settings.strengthPlanOverrides)
  replaceEmomPlanOverrides(backup.settings.emomPlanOverrides)
  try {
    localStorage.setItem('calisthenics-coach-v2:cycle-week', String(backup.settings.cycleWeek))
    localStorage.removeItem('calisthenics-coach-v2:active-emom:v1')
  } catch {}
}
export function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function toCsv(rows: Array<Record<string, string | number | boolean | null>>): string {
  if (!rows.length) return 'date,title,kind,exercise,variation,addedLoadKg,targetReps,actualReps,rir,completed,technique,notes\n'
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))]
  const quote = (value: unknown) => {
    const raw = value == null ? '' : String(value)
    return /[",\n\r]/.test(raw) ? '"' + raw.replace(/"/g, '""') + '"' : raw
  }
  return [columns.map(quote).join(','), ...rows.map(row => columns.map(key => quote(row[key])).join(','))].join('\r\n')
}
export function workoutRowsCsv(workouts: WorkoutLog[]) {
  return toCsv(workouts.flatMap(w => [
    ...w.setLogs.map(s => ({ date:w.date,title:w.title,kind:w.kind,recordType:'set',exercise:s.exerciseId,variation:s.variation,addedLoadKg:s.addedLoadKg,targetReps:s.targetReps,actualReps:s.actualReps,rir:s.rir,completed:s.completed,technique:s.technique,notes:s.notes })),
    ...w.emomLogs.flatMap(e => e.minutes.map(m => ({ date:w.date,title:w.title,kind:w.kind,recordType:'emom-minute',exercise:e.exerciseId,variation:e.variation,addedLoadKg:e.addedLoadKg,targetReps:m.targetReps,actualReps:m.actualReps,rir:e.rir,completed:m.completed,technique:e.technique,notes:e.notes }))),
  ]))
}
