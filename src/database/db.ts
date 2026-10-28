import Dexie, { type Table } from 'dexie'
import type { EmomLog, PersonalRecord, WorkoutLog } from '../types'
class CoachDatabase extends Dexie {
  workouts!: Table<WorkoutLog, string>
  emoms!: Table<EmomLog, string>
  records!: Table<PersonalRecord, string>
  constructor() {
    super('calisthenics-coach-v2')
    this.version(1).stores({
      workouts: 'id, date, kind, completedAt',
      emoms: 'id, exerciseId, startedAt',
      records: 'id, exerciseId, testedAt',
    })
  }
}
export const db = new CoachDatabase()
