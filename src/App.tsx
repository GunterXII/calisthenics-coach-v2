import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, CalendarDays, ChartNoAxesCombined, Dumbbell, History, Plus, Timer, TrendingUp, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { db } from './database/db'
import EmomRunner from './features/emom/EmomRunner'
import { EXERCISES, TRAINING_WEEK } from './data/program'
import type { ExerciseId, SetLog, WorkoutLog } from './types'
import { VALID_LOADS_KG } from './data/program'

type Tab = 'today' | 'plan' | 'history' | 'progress'
const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: 'today', label: 'Oggi', icon: Activity }, { id: 'plan', label: 'Scheda', icon: CalendarDays },
  { id: 'history', label: 'Storico', icon: History }, { id: 'progress', label: 'Progressi', icon: ChartNoAxesCombined },
]
const dayIndex = (new Date().getDay() + 6) % 7
const today = TRAINING_WEEK[dayIndex]

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [showEmom, setShowEmom] = useState(false)
  const [editing, setEditing] = useState<WorkoutLog | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [exerciseId, setExerciseId] = useState<ExerciseId>('pull-up')
  const [reps, setReps] = useState(1)
  const [load, setLoad] = useState(0)
  const [notes, setNotes] = useState('')
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), []) ?? []
  const totalSessions = useLiveQuery(() => db.workouts.count(), []) ?? 0
  const weeklyCount = useMemo(() => workouts.filter(w => Date.now() - new Date(w.date).getTime() < 7 * 86400000).length, [workouts])
  const saveEdit = async () => { if (!editing) return; await db.workouts.put(editing); setEditing(null) }
  const deleteWorkout = async () => { if (!deleteId) return; await db.workouts.delete(deleteId); setDeleteId(null) }
  const addQuickLog = async () => {
    const now = Date.now()
    const entry: WorkoutLog = {
      id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), dayLabel: 'Sessione libera',
      kind: 'strength', title: EXERCISES.find(e => e.id === exerciseId)?.name ?? 'Allenamento',
      setLogs: [{ id: crypto.randomUUID(), exerciseId, variation: 'Strict', addedLoadKg: load, targetReps: reps, actualReps: reps, rir: null, completed: true, technique: 'good', notes: '', createdAt: now }],
      emomLogs: [], fatigue: null, sleepHours: null, pain: '', notes, completedAt: now,
    }
    await db.workouts.add(entry)
    setShowQuickLog(false); setNotes('')
  }
  return <div className="app-shell">
    <header className="topbar"><div className="brand-mark">C<span>.</span></div><div className="brand-copy"><strong>CALISTHENICS COACH</strong><small>PERSONAL TRAINING SYSTEM</small></div><div className="topbar-status"><span className="status-dot" /> LOCAL</div></header>
    <main className="main-content">
      {tab === 'today' && <section>
        <div className="eyebrow">{new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase()}</div>
        <div className="hero-row"><div><h1>Allenati con<br/><span>intenzione.</span></h1><p className="muted">Costanza, tecnica, progressione.</p></div><div className="hero-icon"><Dumbbell size={25}/></div></div>
        <div className="stats-grid"><Stat label="SESSIONI TOTALI" value={totalSessions.toString().padStart(2,'0')}/><Stat label="ULTIMI 7 GIORNI" value={weeklyCount.toString().padStart(2,'0')}/><Stat label="CICLO" value="01 / 04"/></div>
        <div className="section-heading"><div><div className="eyebrow">PROGRAMMA</div><h2>{today.label} <span className="muted">/ {today.focus}</span></h2></div><span className="tag">SETTIMANA BASE</span></div>
        {today.prescriptions.length ? <div className="exercise-list">{today.prescriptions.map((p,i)=><article className="exercise-card" key={today.id+i}><div className="exercise-index">{String(i+1).padStart(2,'0')}</div><div className="exercise-info"><strong>{p.title}</strong><span>{p.durationMinutes ? `${p.durationMinutes} min · ${p.repsPerMinute} rep/min` : `${p.sets} serie · ${p.reps} rep`} · {p.addedLoadKg} kg</span></div><span className="exercise-arrow">↗</span></article>)}</div> : <div className="rest-card"><span>RECUPERO PROGRAMMATO</span><h3>Oggi si recupera.</h3><p>Il recupero fa parte della progressione.</p></div>}
        <button className="primary-button" onClick={()=>setShowQuickLog(true)}><Plus size={18}/> REGISTRA PRESTAZIONE</button><button className="secondary-button full" onClick={()=>setShowEmom(true)}><Timer size={17}/> AVVIA EMOM PERSONALIZZATO</button>
      </section>}
      {tab === 'plan' && <section><div className="eyebrow">IL TUO SISTEMA</div><h1>La scheda<span>.</span></h1><p className="muted">Settimana tipo · 3 settimane di carico + 1 di deload.</p>{TRAINING_WEEK.map(day=><div className="plan-day" key={day.id}><div className="plan-day-head"><strong>{day.label}</strong><span>{day.focus}</span></div>{day.prescriptions.length ? day.prescriptions.map((p,i)=><div className="plan-line" key={i}><span>{p.title}</span><small>{p.durationMinutes ? `${p.durationMinutes}×${p.repsPerMinute}` : `${p.sets}×${p.reps}`} · {p.addedLoadKg} kg</small></div>) : <small className="muted">Riposo</small>}</div>)}</section>}
      {tab === 'history' && <section><div className="eyebrow">DATABASE PERSONALE</div><h1>Storico<span>.</span></h1>{workouts.length ? workouts.map(w=><article className="history-card history-card-edit" key={w.id}><div className="history-main"><strong>{w.title}</strong><small>{w.date} · {w.setLogs.length} serie · {w.emomLogs.length} EMOM</small><small>{w.notes || 'Nessuna nota'}</small></div><span>{w.setLogs.reduce((n,s)=>n+s.actualReps,0)+w.emomLogs.reduce((n,e)=>n+e.minutes.reduce((a,m)=>a+m.actualReps,0),0)} reps</span><button className="icon-button" aria-label="Modifica" onClick={()=>setEditing(structuredClone(w))}><Pencil size={16}/></button><button className="icon-button danger" aria-label="Elimina" onClick={()=>setDeleteId(w.id)}><Trash2 size={16}/></button></article>) : <div className="empty-state">Le tue sessioni appariranno qui, una volta registrate.</div>}</section>}
      {tab === 'progress' && <section><div className="eyebrow">DATI, NON SENSAZIONI</div><h1>Progressi<span>.</span></h1><div className="stats-grid"><Stat label="PULL-UP TARGET" value="30"/><Stat label="DIP TARGET" value="64"/><Stat label="PUSH-UP TARGET" value="100"/></div><div className="empty-state"><TrendingUp size={22}/><p>Registra test massimali e allenamenti per costruire il tuo storico.</p></div></section>}
    </main>
    <nav className="bottom-nav">{tabs.map(({id,label,icon:Icon})=><button key={id} className={tab===id?'nav-item active':'nav-item'} onClick={()=>setTab(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {showEmom && <EmomRunner onClose={()=>setShowEmom(false)}/>}
    {editing && <WorkoutEditor workout={editing} onChange={setEditing} onClose={()=>setEditing(null)} onSave={()=>void saveEdit()}/>}
    {deleteId && <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>Eliminare la sessione?</h2><button className="close-button" onClick={()=>setDeleteId(null)}>×</button></div><p className="muted">Questa azione non può essere annullata.</p><div className="form-grid"><button className="secondary-button" onClick={()=>setDeleteId(null)}>ANNULLA</button><button className="primary-button" onClick={()=>void deleteWorkout()}>ELIMINA</button></div></div></div>}
    {showQuickLog && <div className="modal-backdrop" onClick={()=>setShowQuickLog(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">NUOVA REGISTRAZIONE</div><h2>Log rapido</h2></div><button className="close-button" onClick={()=>setShowQuickLog(false)}>×</button></div><label>Esercizio<select value={exerciseId} onChange={e=>setExerciseId(e.target.value as ExerciseId)}>{EXERCISES.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><div className="form-grid"><label>Ripetizioni<input type="number" min="0" value={reps} onChange={e=>setReps(Math.max(0,Number(e.target.value)))}/></label><label>Zavorra<select value={load} onChange={e=>setLoad(Number(e.target.value))}>{[0,5,10,15,20,25,30].map(v=><option key={v} value={v}>{v} kg</option>)}</select></label></div><label>Note<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Tecnica, sensazioni..."/></label><button className="primary-button full" onClick={()=>void addQuickLog()}>SALVA NELLO STORICO</button></div></div>}
  </div>
}
function Stat({label,value}:{label:string;value:string}) { return <div className="stat-card"><small>{label}</small><strong>{value}</strong></div> }
