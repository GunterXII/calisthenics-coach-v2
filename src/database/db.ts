import Dexie, { type Table } from 'dexie'
import type { EmomLog, PersonalRecord, TrainingSession, WorkoutLog } from '../types'
class CoachDatabase extends Dexie {
  workouts!: Table<WorkoutLog, string>
  emoms!: Table<EmomLog, string>
  records!: Table<PersonalRecord, string>
  trainingSessions!: Table<TrainingSession, string>
  constructor() {
    super('calisthenics-coach-v2')
    this.version(1).stores({
      workouts: 'id, date, kind, completedAt',
      emoms: 'id, exerciseId, startedAt',
      records: 'id, exerciseId, testedAt',
    })
    this.version(2).stores({
      workouts: 'id, date, kind, completedAt',
      emoms: 'id, exerciseId, startedAt',
      records: 'id, exerciseId, testedAt',
      trainingSessions: 'id, date, startedAt, endedAt',
    })
  }
}
export const db = new CoachDatabase()
