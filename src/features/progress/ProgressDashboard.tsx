import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts'
import { Pencil, Trash2 } from 'lucide-react'
import { db } from '../../database/db'
import { EXERCISES } from '../../data/program'
import type { ExerciseId, PersonalRecord, WorkoutLog } from '../../types'

type Range = '30' | '90' | 'all'
type VolumeFilter = 'all' | 'emom' | ExerciseId
const TRACKED: ExerciseId[] = ['pull-up', 'dip', 'push-up', 'muscle-up']
const TARGETS: Record<string, number> = { 'pull-up': 30, dip: 64, 'push-up': 100, 'muscle-up': 15 }
const LABELS: Record<string, string> = { 'pull-up': 'Pull-up', dip: 'Dip', 'push-up': 'Push-up', 'muscle-up': 'Muscle-up' }

function dateKey(date: Date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
}

function mondayKey(day: string) {
  const date = new Date(day + 'T12:00:00')
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return dateKey(date)
}

export default function ProgressDashboard({ workouts }: { workouts: WorkoutLog[] }) {
  const records = useLiveQuery(() => db.records.orderBy('testedAt').reverse().toArray(), []) ?? []
  const [range, setRange] = useState<Range>('90')
  const [exercise, setExercise] = useState<ExerciseId>('pull-up')
  const [volumeFilter, setVolumeFilter] = useState<VolumeFilter>('all')
  const [emomExercise, setEmomExercise] = useState<ExerciseId>('pull-up')
  const [emomVariation, setEmomVariation] = useState('all')
  const [emomLoad, setEmomLoad] = useState('all')
  const [showTest, setShowTest] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [testExercise, setTestExercise] = useState<ExerciseId>('pull-up')
  const [testReps, setTestReps] = useState('26')
  const [testDate, setTestDate] = useState(dateKey(new Date()))
  const [testNotes, setTestNotes] = useState('')

  const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000
  const filtered = useMemo(() => workouts.filter(w => new Date(w.date + 'T12:00:00').getTime() >= cutoff), [workouts, cutoff])

  const performance = useMemo(() => {
    const byDate = new Map<string, { date: string; reps: number; load: number }>()
    filtered.forEach(workout => workout.setLogs.filter(set => set.exerciseId === exercise && set.completed).forEach(set => {
      const previous = byDate.get(workout.date)
      byDate.set(workout.date, {
        date: workout.date,
        reps: Math.max(previous?.reps ?? 0, set.actualReps),
        load: Math.max(previous?.load ?? 0, set.addedLoadKg),
      })
    }))
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map(point => ({ ...point, date: point.date.slice(5) }))
  }, [filtered, exercise])

  const weekly = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach(workout => {
      let total = 0
      if (volumeFilter === 'all') {
        total = workout.setLogs.reduce((sum, set) => sum + set.actualReps, 0) +
          workout.emomLogs.reduce((sum, emom) => sum + emom.minutes.reduce((n, minute) => n + minute.actualReps, 0), 0)
      } else if (volumeFilter === 'emom') {
        total = workout.emomLogs.reduce((sum, emom) => sum + emom.minutes.reduce((n, minute) => n + minute.actualReps, 0), 0)
      } else {
        total = workout.setLogs.filter(set => set.exerciseId === volumeFilter).reduce((sum, set) => sum + set.actualReps, 0) +
          workout.emomLogs.filter(emom => emom.exerciseId === volumeFilter).reduce((sum, emom) => sum + emom.minutes.reduce((n, minute) => n + minute.actualReps, 0), 0)
      }
      const key = mondayKey(workout.date)
      map.set(key, (map.get(key) ?? 0) + total)
    })
    return [...map].sort((a, b) => a[0].localeCompare(b[0])).map(([week, reps]) => ({ week: week.slice(5), reps }))
  }, [filtered, volumeFilter])

  const emomLogs = useMemo(() => filtered.flatMap(workout => workout.emomLogs).sort((a, b) => a.startedAt - b.startedAt), [filtered])
  const availableVariations = useMemo(() => [...new Set(workouts.flatMap(workout => workout.emomLogs).filter(log => log.exerciseId === emomExercise).map(log => log.variation))].sort((a, b) => a.localeCompare(b)), [workouts, emomExercise])
  const emomSeries = useMemo(() => emomLogs
    .filter(log => log.exerciseId === emomExercise)
    .filter(log => emomVariation === 'all' || log.variation === emomVariation)
    .filter(log => emomLoad === 'all' || log.addedLoadKg === Number(emomLoad))
    .map(log => {
      const validMinutes = log.minutes.filter(minute => !minute.skipped)
      const averageActual = validMinutes.length ? validMinutes.reduce((sum, minute) => sum + minute.actualReps, 0) / validMinutes.length : 0
      const averageTarget = validMinutes.length ? validMinutes.reduce((sum, minute) => sum + minute.targetReps, 0) / validMinutes.length : log.repsPerMinute
      const completed = log.minutes.filter(minute => !minute.skipped && minute.actualReps >= minute.targetReps).length
      return {
        date: new Date(log.startedAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        averageActual: Number(averageActual.toFixed(1)),
        averageTarget: Number(averageTarget.toFixed(1)),
        completion: log.durationMinutes ? Math.round(completed / log.durationMinutes * 100) : 0,
        load: log.addedLoadKg,
      }
    }), [emomLogs, emomExercise, emomVariation, emomLoad])

  const activity = useMemo(() => {
    const counts = new Map<string, number>()
    workouts.forEach(workout => counts.set(workout.date, (counts.get(workout.date) ?? 0) + 1))
    const days: { date: string; count: number; label: string }[] = []
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    for (let offset = 27; offset >= 0; offset -= 1) {
      const day = new Date(today)
      day.setDate(today.getDate() - offset)
      const key = dateKey(day)
      days.push({ date: key, count: counts.get(key) ?? 0, label: day.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) })
    }
    return days
  }, [workouts])

  const maxRecord = (id: ExerciseId) => Math.max(0, ...records.filter(record => record.exerciseId === id).map(record => record.reps))

  const saveTest = async () => {
    const reps = Number(testReps)
    if (!Number.isFinite(reps) || reps < 1 || !testDate) return
    const record: PersonalRecord = {
      id: editingRecordId ?? crypto.randomUUID(),
      exerciseId: testExercise,
      reps: Math.floor(reps),
      testedAt: new Date(testDate + 'T12:00:00').getTime(),
      notes: testNotes.trim(),
    }
    if (editingRecordId) await db.records.put(record)
    else await db.records.add(record)
    setShowTest(false)
    setEditingRecordId(null)
    setTestNotes('')
  }

  const editRecord = (record: PersonalRecord) => {
    setEditingRecordId(record.id)
    setTestExercise(record.exerciseId)
    setTestReps(String(record.reps))
    setTestDate(dateKey(new Date(record.testedAt)))
    setTestNotes(record.notes)
    setShowTest(true)
  }

  const deleteRecord = async (record: PersonalRecord) => {
    if (!window.confirm('Eliminare questo test massimale? Il record verrà rimosso dallo storico.')) return
    await db.records.delete(record.id)
  }

  return <div className="progress-dashboard">
    <div className="progress-target-grid">{TRACKED.map(id => <article className="target-card" key={id}>
      <small>{LABELS[id].toUpperCase()}</small><strong>{maxRecord(id) || '—'}<i> / {TARGETS[id]}</i></strong>
      <div className="target-track"><span style={{ width: String(Math.min(100, maxRecord(id) / TARGETS[id] * 100)) + '%' }} /></div>
      <em>{maxRecord(id) ? Math.round(maxRecord(id) / TARGETS[id] * 100) + '% del target' : 'Registra un test'}</em>
    </article>)}</div>

    <div className="progress-toolbar"><div><div className="eyebrow">ANDAMENTO</div><h2>Prestazioni</h2></div><div className="range-switch">{(['30', '90', 'all'] as Range[]).map(value => <button key={value} className={range === value ? 'selected' : ''} onClick={() => setRange(value)}>{value === 'all' ? 'TUTTO' : value + 'G'}</button>)}</div></div>
    <div className="chart-panel"><div className="chart-head"><strong>Ripetizioni per sessione</strong><select value={exercise} onChange={event => setExercise(event.target.value as ExerciseId)}>{TRACKED.map(id => <option key={id} value={id}>{LABELS[id]}</option>)}</select></div>
      {performance.length ? <ResponsiveContainer width="100%" height={220}><AreaChart data={performance}><defs><linearGradient id="repsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b7f500" stopOpacity={.28} /><stop offset="95%" stopColor="#b7f500" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#292929" vertical={false} /><XAxis dataKey="date" stroke="#777" tickLine={false} axisLine={false} /><YAxis stroke="#777" tickLine={false} axisLine={false} width={28} /><Tooltip contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 10 }} /><Area type="monotone" dataKey="reps" name="Ripetizioni" stroke="#b7f500" fill="url(#repsFill)" strokeWidth={2} dot={{ r: 3, fill: '#b7f500' }} /></AreaChart></ResponsiveContainer> : <div className="chart-empty">Nessun dato per questo esercizio nel periodo selezionato.</div>}
    </div>

    <div className="chart-panel"><div className="chart-head"><strong>Progressione della zavorra</strong><small>{LABELS[exercise]} · kg aggiunti</small></div>
      {performance.some(point => point.load > 0) ? <ResponsiveContainer width="100%" height={170}><AreaChart data={performance}><CartesianGrid stroke="#292929" vertical={false} /><XAxis dataKey="date" stroke="#777" tickLine={false} axisLine={false} /><YAxis stroke="#777" tickLine={false} axisLine={false} width={28} /><Tooltip contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 10 }} /><Area type="stepAfter" dataKey="load" name="Zavorra (kg)" stroke="#8ab4ff" fill="#8ab4ff" fillOpacity={.12} strokeWidth={2} /></AreaChart></ResponsiveContainer> : <div className="chart-empty">Registra serie zavorrate per visualizzare l'andamento dei carichi aggiunti.</div>}
    </div>

    <div className="chart-panel"><div className="chart-head"><strong>Volume settimanale</strong><select value={volumeFilter} onChange={event => setVolumeFilter(event.target.value as VolumeFilter)}><option value="all">Tutti gli esercizi</option><option value="emom">Solo EMOM</option>{EXERCISES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><small className="chart-subtitle">Ripetizioni registrate per settimana</small>
      {weekly.length ? <ResponsiveContainer width="100%" height={190}><BarChart data={weekly}><CartesianGrid stroke="#292929" vertical={false} /><XAxis dataKey="week" stroke="#777" tickLine={false} axisLine={false} /><YAxis stroke="#777" tickLine={false} axisLine={false} width={28} /><Tooltip contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 10 }} /><Bar dataKey="reps" name="Ripetizioni" fill="#b7f500" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="chart-empty">Il volume apparirà dopo le prime sessioni.</div>}
    </div>

    <div className="chart-panel"><div className="chart-head"><strong>Analisi EMOM</strong><small>Media delle reps/min registrate</small></div>
      <div className="emom-filter-grid">
        <label>Esercizio<select value={emomExercise} onChange={event => { setEmomExercise(event.target.value as ExerciseId); setEmomVariation('all') }}>{EXERCISES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Variante<select value={emomVariation} onChange={event => setEmomVariation(event.target.value)}><option value="all">Tutte</option>{availableVariations.map(variation => <option key={variation} value={variation}>{variation}</option>)}</select></label>
        <label>Zavorra<select value={emomLoad} onChange={event => setEmomLoad(event.target.value)}><option value="all">Tutte</option>{[0, 5, 10, 15, 20, 25, 30].map(load => <option key={load} value={String(load)}>{load} kg</option>)}</select></label>
      </div>
      {emomSeries.length ? <><ResponsiveContainer width="100%" height={190}><AreaChart data={emomSeries}><CartesianGrid stroke="#292929" vertical={false} /><XAxis dataKey="date" stroke="#777" tickLine={false} axisLine={false} /><YAxis stroke="#777" tickLine={false} axisLine={false} width={28} /><Tooltip contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 10 }} /><Area type="monotone" dataKey="averageTarget" name="Target medio" stroke="#666" fill="#666" fillOpacity={.08} /><Area type="monotone" dataKey="averageActual" name="Media effettiva" stroke="#b7f500" fill="#b7f500" fillOpacity={.16} /></AreaChart></ResponsiveContainer><p className="chart-subtitle">Completamento medio della sessione più recente: {emomSeries[emomSeries.length - 1].completion}% · zavorra {emomSeries[emomSeries.length - 1].load} kg.</p></> : <div className="chart-empty">Registra una sessione EMOM per confrontare target e ripetizioni effettive per variante e carico.</div>}
    </div>

    <div className="chart-panel"><div className="chart-head"><strong>Attività recente</strong><small>Ultimi 28 giorni</small></div><div className="activity-calendar">{activity.map(day => <div key={day.date} title={day.label + ': ' + day.count + (day.count === 1 ? ' sessione' : ' sessioni')} aria-label={day.label + ': ' + day.count + ' sessioni'} className={'activity-day level-' + Math.min(day.count, 3)} />)}</div><div className="activity-legend"><span>0</span><i className="level-1" /><i className="level-2" /><i className="level-3" /><span>sessioni / giorno</span></div></div>

    <div className="records-head"><div><div className="eyebrow">TEST MASSIMALI</div><h2>Record personali</h2></div><button className="secondary-button" onClick={() => { setEditingRecordId(null); setTestExercise('pull-up'); setTestReps(''); setTestDate(dateKey(new Date())); setTestNotes(''); setShowTest(value => !value) }}>+ REGISTRA TEST</button></div>
    {showTest && <div className="test-form"><div className="chart-head"><strong>{editingRecordId ? 'Modifica test' : 'Nuovo test'}</strong><button type="button" className="text-action" onClick={() => { setShowTest(false); setEditingRecordId(null) }}>ANNULLA</button></div><label>Esercizio<select value={testExercise} onChange={event => setTestExercise(event.target.value as ExerciseId)}>{EXERCISES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="form-grid"><label>Ripetizioni<input type="number" min="1" value={testReps} onChange={event => setTestReps(event.target.value)} /></label><label>Data<input type="date" value={testDate} onChange={event => setTestDate(event.target.value)} /></label></div><label>Note<input value={testNotes} onChange={event => setTestNotes(event.target.value)} placeholder="Tecnica, condizioni, contesto…" /></label><button className="primary-button" onClick={() => void saveTest()}>{editingRecordId ? 'SALVA MODIFICHE' : 'SALVA TEST'}</button></div>}
    {records.length ? <div className="record-list">{records.map(record => <article key={record.id}><div><strong>{LABELS[record.exerciseId] ?? record.exerciseId}</strong><small>{new Date(record.testedAt).toLocaleDateString('it-IT')} {record.notes ? '· ' + record.notes : ''}</small></div><b>{record.reps} reps</b><button type="button" className="icon-button" aria-label="Modifica record" onClick={() => editRecord(record)}><Pencil size={15} /></button><button type="button" className="icon-button danger" aria-label="Elimina record" onClick={() => void deleteRecord(record)}><Trash2 size={15} /></button></article>)}</div> : <div className="chart-empty">I test massimali sono separati dagli allenamenti: registra qui i tuoi record senza alterare lo storico delle sessioni.</div>}
  </div>
}
