import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts'
import { db } from '../../database/db'
import { EXERCISES } from '../../data/program'
import type { ExerciseId, PersonalRecord, WorkoutLog } from '../../types'

type Range = '30' | '90' | 'all'
const TRACKED: ExerciseId[] = ['pull-up', 'dip', 'push-up', 'muscle-up']
const TARGETS: Record<string, number> = { 'pull-up': 30, dip: 64, 'push-up': 100, 'muscle-up': 15 }
const LABELS: Record<string, string> = { 'pull-up': 'Pull-up', dip: 'Dip', 'push-up': 'Push-up', 'muscle-up': 'Muscle-up' }

export default function ProgressDashboard({ workouts }: { workouts: WorkoutLog[] }) {
  const records = useLiveQuery(() => db.records.orderBy('testedAt').reverse().toArray(), []) ?? []
  const [range, setRange] = useState<Range>('90')
  const [exercise, setExercise] = useState<ExerciseId>('pull-up')
  const [showTest, setShowTest] = useState(false)
  const [testExercise, setTestExercise] = useState<ExerciseId>('pull-up')
  const [testReps, setTestReps] = useState('26')
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0,10))
  const [testNotes, setTestNotes] = useState('')

  const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000
  const filtered = useMemo(() => workouts.filter(w => new Date(w.date).getTime() >= cutoff), [workouts, cutoff])
  const series = useMemo(() => {
    const points = filtered.flatMap(w => w.setLogs.filter(s => s.exerciseId === exercise).map(s => ({ date: w.date, reps: s.actualReps, load: s.addedLoadKg, volume: s.actualReps * (s.addedLoadKg || 1) })))
      .sort((a,b) => a.date.localeCompare(b.date))
    const bestByDate = new Map<string, number>()
    points.forEach(p => bestByDate.set(p.date, Math.max(bestByDate.get(p.date) ?? 0, p.reps)))
    return [...bestByDate].map(([date,reps]) => ({ date: date.slice(5), reps }))
  }, [filtered, exercise])
  const weekly = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach(w => {
      const d = new Date(w.date + 'T12:00:00')
      const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay()+6)%7))
      const key = monday.toISOString().slice(5,10)
      const total = w.setLogs.reduce((sum,s) => sum + s.actualReps,0) + w.emomLogs.reduce((sum,e) => sum + e.minutes.reduce((n,m)=>n+m.actualReps,0),0)
      map.set(key,(map.get(key) ?? 0)+total)
    })
    return [...map].sort((a,b)=>a[0].localeCompare(b[0])).map(([week,reps])=>({week,reps}))
  }, [filtered])
  const maxRecord = (id: ExerciseId) => Math.max(0, ...records.filter(r=>r.exerciseId===id).map(r=>r.reps))
  const saveTest = async () => {
    const reps = Number(testReps)
    if (!Number.isFinite(reps) || reps < 1) return
    const record: PersonalRecord = { id: crypto.randomUUID(), exerciseId: testExercise, reps, testedAt: new Date(testDate+'T12:00:00').getTime(), notes: testNotes.trim() }
    await db.records.add(record); setShowTest(false); setTestNotes('')
  }
  return <div className="progress-dashboard">
    <div className="progress-target-grid">{TRACKED.map(id=><article className="target-card" key={id}><small>{LABELS[id].toUpperCase()}</small><strong>{maxRecord(id) || '—'}<i> / {TARGETS[id]}</i></strong><div className="target-track"><span style={{width:`${Math.min(100,maxRecord(id)/TARGETS[id]*100)}%`}}/></div><em>{maxRecord(id) ? Math.round(maxRecord(id)/TARGETS[id]*100)+'% del target' : 'Registra un test'}</em></article>)}</div>
    <div className="progress-toolbar"><div><div className="eyebrow">ANDAMENTO</div><h2>Prestazioni</h2></div><div className="range-switch">{(['30','90','all'] as Range[]).map(v=><button key={v} className={range===v?'selected':''} onClick={()=>setRange(v)}>{v==='all'?'TUTTO':v+'G'}</button>)}</div></div>
    <div className="chart-panel"><div className="chart-head"><strong>Ripetizioni per sessione</strong><select value={exercise} onChange={e=>setExercise(e.target.value as ExerciseId)}>{TRACKED.map(id=><option key={id} value={id}>{LABELS[id]}</option>)}</select></div>{series.length ? <ResponsiveContainer width="100%" height={220}><AreaChart data={series}><defs><linearGradient id="repsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b7f500" stopOpacity={.28}/><stop offset="95%" stopColor="#b7f500" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#292929" vertical={false}/><XAxis dataKey="date" stroke="#777" tickLine={false} axisLine={false}/><YAxis stroke="#777" tickLine={false} axisLine={false} width={28}/><Tooltip contentStyle={{background:'#171717',border:'1px solid #333',borderRadius:10}}/><Area type="monotone" dataKey="reps" stroke="#b7f500" fill="url(#repsFill)" strokeWidth={2} dot={{r:3,fill:'#b7f500'}}/></AreaChart></ResponsiveContainer> : <div className="chart-empty">Nessun dato per questo esercizio nel periodo selezionato.</div>}</div>
    <div className="chart-panel"><div className="chart-head"><strong>Volume settimanale</strong><small>Ripetizioni totali registrate</small></div>{weekly.length ? <ResponsiveContainer width="100%" height={190}><BarChart data={weekly}><CartesianGrid stroke="#292929" vertical={false}/><XAxis dataKey="week" stroke="#777" tickLine={false} axisLine={false}/><YAxis stroke="#777" tickLine={false} axisLine={false} width={28}/><Tooltip contentStyle={{background:'#171717',border:'1px solid #333',borderRadius:10}}/><Bar dataKey="reps" fill="#b7f500" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <div className="chart-empty">Il volume apparirà dopo le prime sessioni.</div>}</div>
    <div className="records-head"><div><div className="eyebrow">TEST MASSIMALI</div><h2>Record personali</h2></div><button className="secondary-button" onClick={()=>setShowTest(v=>!v)}>+ REGISTRA TEST</button></div>
    {showTest && <div className="test-form"><label>Esercizio<select value={testExercise} onChange={e=>setTestExercise(e.target.value as ExerciseId)}>{EXERCISES.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><div className="form-grid"><label>Ripetizioni<input type="number" min="1" value={testReps} onChange={e=>setTestReps(e.target.value)}/></label><label>Data<input type="date" value={testDate} onChange={e=>setTestDate(e.target.value)}/></label></div><label>Note<input value={testNotes} onChange={e=>setTestNotes(e.target.value)} placeholder="Tecnica, condizioni, contesto…"/></label><button className="primary-button" onClick={()=>void saveTest()}>SALVA TEST</button></div>}
    {records.length ? <div className="record-list">{records.map(r=><article key={r.id}><div><strong>{LABELS[r.exerciseId] ?? r.exerciseId}</strong><small>{new Date(r.testedAt).toLocaleDateString('it-IT')} {r.notes ? '· '+r.notes : ''}</small></div><b>{r.reps} reps</b></article>)}</div> : <div className="chart-empty">I test massimali sono separati dagli allenamenti: registra qui i tuoi record senza alterare lo storico delle sessioni.</div>}
  </div>
}
