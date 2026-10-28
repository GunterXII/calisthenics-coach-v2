import { db } from '../database/db'
import type { EmomLog, PersonalRecord, WorkoutLog } from '../types'

export interface CoachBackup {
  app: 'calisthenics-coach-v2'
  schemaVersion: 1
  exportedAt: string
  data: { workouts: WorkoutLog[]; emoms: EmomLog[]; records: PersonalRecord[] }
}
export async function createBackup(): Promise<CoachBackup> {
  const [workouts, emoms, records] = await Promise.all([
    db.workouts.toArray(), db.emoms.toArray(), db.records.toArray(),
  ])
  return { app: 'calisthenics-coach-v2', schemaVersion: 1, exportedAt: new Date().toISOString(), data: { workouts, emoms, records } }
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function hasId(value: unknown): value is { id: string } {
  return isObject(value) && typeof value.id === 'string' && value.id.length > 0
}
export function parseBackup(value: unknown): CoachBackup {
  if (!isObject(value) || value.app !== 'calisthenics-coach-v2' || value.schemaVersion !== 1 || !isObject(value.data)) {
    throw new Error('File non riconosciuto o versione del backup non supportata.')
  }
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
  return value as unknown as CoachBackup
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
}
export function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  URL.revokeObjectURL(url)
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
  return toCsv(workouts.flatMap(w => w.setLogs.map(s => ({
    date:w.date,title:w.title,kind:w.kind,exercise:s.exerciseId,variation:s.variation,
    addedLoadKg:s.addedLoadKg,targetReps:s.targetReps,actualReps:s.actualReps,
    rir:s.rir,completed:s.completed,technique:s.technique,notes:s.notes,
  }))))
}
