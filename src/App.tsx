import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, CalendarDays, ChartNoAxesCombined, Dumbbell, History, Plus, Timer, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { db } from './database/db'
import EmomRunner from './features/emom/EmomRunner'
import WorkoutLogger from './features/workout/WorkoutLogger'
import ProgressDashboard from './features/progress/ProgressDashboard'
import DataManagement from './features/data/DataManagement'
import RecoveryAdvisor from './features/recovery/RecoveryAdvisor'
import { EXERCISES, TRAINING_WEEK, VALID_LOADS_KG, prescriptionSummary, prescriptionNotes, type CycleWeek } from './data/program'
import type { ExerciseId, SetLog, WorkoutLog } from './types'

type Tab = 'today' | 'plan' | 'history' | 'progress'
const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: 'today', label: 'Oggi', icon: Activity }, { id: 'plan', label: 'Scheda', icon: CalendarDays },
  { id: 'history', label: 'Storico', icon: History }, { id: 'progress', label: 'Progressi', icon: ChartNoAxesCombined },
]
const dayIndex = (new Date().getDay() + 6) % 7
const today = TRAINING_WEEK[dayIndex]

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [cycleWeek, setCycleWeek] = useState<CycleWeek>(() => {
    try { const value = Number(localStorage.getItem('calisthenics-coach-v2:cycle-week')); return [1, 2, 3, 4].includes(value) ? value as CycleWeek : 1 } catch { return 1 }
  })
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [showEmom, setShowEmom] = useState(false)
  const [editing, setEditing] = useState<WorkoutLog | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), []) ?? []
  const totalSessions = useLiveQuery(() => db.workouts.count(), []) ?? 0
  const weeklyCount = useMemo(() => workouts.filter(w => { const age = Date.now() - new Date(w.date + 'T23:59:59').getTime(); return age >= 0 && age < 7 * 86400000 }).length, [workouts])
  const saveEdit = async () => { if (!editing) return; await db.workouts.put(editing); setEditing(null) }
  const deleteWorkout = async () => { if (!deleteId) return; const workout = await db.workouts.get(deleteId); await db.transaction('rw', db.workouts, db.emoms, async () => { if (workout) for (const emom of workout.emomLogs) await db.emoms.delete(emom.id); await db.workouts.delete(deleteId) }); setDeleteId(null) }
  return <div className="app-shell">
    <header className="topbar"><div className="brand-mark">C<span>.</span></div><div className="brand-copy"><strong>CALISTHENICS COACH</strong><small>PERSONAL TRAINING SYSTEM</small></div><div className="topbar-status"><span className="status-dot" /> LOCAL</div></header>
    <main className="main-content">
      {tab === 'today' && <section>
        <div className="eyebrow">{new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase()}</div>
        <div className="hero-row"><div><h1>Allenati con<br/><span>intenzione.</span></h1><p className="muted">Costanza, tecnica, progressione.</p></div><div className="hero-icon"><Dumbbell size={25}/></div></div>
        <div className="stats-grid"><Stat label="SESSIONI TOTALI" value={totalSessions.toString().padStart(2,'0')}/><Stat label="ULTIMI 7 GIORNI" value={weeklyCount.toString().padStart(2,'0')}/><Stat label="CICLO" value={String(cycleWeek).padStart(2, '0') + " / 04"}/></div>
        <RecoveryAdvisor workouts={workouts} />
        <div className="section-heading"><div><div className="eyebrow">PROGRAMMA</div><h2>{today.label} <span className="muted">/ {today.focus}</span></h2></div><span className="tag">SETTIMANA BASE</span></div>
        {(cycleWeek === 4 ? today.prescriptions.filter(p => !p.optional) : today.prescriptions).length ? <div className="exercise-list">{(cycleWeek === 4 ? today.prescriptions.filter(p => !p.optional) : today.prescriptions).map((p,i)=><article className="exercise-card" key={today.id+i}><div className="exercise-index">{String(i+1).padStart(2,'0')}</div><div className="exercise-info"><strong>{p.title}</strong><span>{prescriptionSummary(p, cycleWeek)}</span>{p.notes && <small className="plan-notes">{prescriptionNotes(p, cycleWeek)}</small>}</div><span className="exercise-arrow">↗</span></article>)}</div> : <div className="rest-card"><span>RECUPERO PROGRAMMATO</span><h3>Oggi si recupera.</h3><p>Il recupero fa parte della progressione.</p></div>}
        <button className="primary-button" onClick={()=>setShowQuickLog(true)}><Plus size={18}/> REGISTRA PRESTAZIONE</button><button className="secondary-button full" onClick={()=>setShowEmom(true)}><Timer size={17}/> AVVIA EMOM PERSONALIZZATO</button>
      </section>}
      {tab === 'plan' && <section><div className="eyebrow">IL TUO SISTEMA</div><h1>La scheda<span>.</span></h1><p className="muted">3 settimane di carico + 1 settimana di deload. La selezione viene salvata su questo dispositivo.</p><div className="cycle-selector" aria-label="Settimana del ciclo">{([1,2,3,4] as CycleWeek[]).map(week=><button key={week} type="button" className={cycleWeek===week?'selected':''} onClick={()=>{setCycleWeek(week);try{localStorage.setItem('calisthenics-coach-v2:cycle-week',String(week))}catch{}}}><small>SETTIMANA</small><strong>{String(week).padStart(2,'0')}</strong><span>{week===4?'DELOAD':'CARICO'}</span></button>)}</div>{cycleWeek===4 && <div className="deload-banner"><strong>Settimana di scarico attiva</strong><span>Volume ridotto circa del 40%, carico ridotto ove possibile e niente drop set, cedimento o circuiti massimali. Le registrazioni non vengono modificate automaticamente.</span></div>}{TRAINING_WEEK.map(day=><div className="plan-day" key={day.id}><div className="plan-day-head"><strong>{day.label}</strong><span>{day.focus}</span></div>{(cycleWeek===4?day.prescriptions.filter(p=>!p.optional):day.prescriptions).length ? (cycleWeek===4?day.prescriptions.filter(p=>!p.optional):day.prescriptions).map((p,i)=><div className="plan-line" key={i}><div className="plan-line-copy"><span>{p.title}{p.optional && <small className="optional-tag">OPZIONALE</small>}</span><p className="plan-notes">{prescriptionNotes(p,cycleWeek)}</p></div><small>{prescriptionSummary(p,cycleWeek)}</small></div>) : <small className="muted">Riposo</small>}</div>)}</section>}
      {tab === 'history' && <section><div className="eyebrow">DATABASE PERSONALE</div><h1>Storico<span>.</span></h1>{workouts.length ? workouts.map(w=><article className="history-card history-card-edit" key={w.id}><div className="history-main"><strong>{w.title}</strong><small>{w.date} · {w.setLogs.length} serie · {w.emomLogs.length} EMOM</small><small>{w.notes || 'Nessuna nota'}</small></div><span>{w.setLogs.reduce((n,s)=>n+s.actualReps,0)+w.emomLogs.reduce((n,e)=>n+e.minutes.reduce((a,m)=>a+m.actualReps,0),0)} reps</span><button className="icon-button" aria-label="Modifica" onClick={()=>setEditing(structuredClone(w))}><Pencil size={16}/></button><button className="icon-button danger" aria-label="Elimina" onClick={()=>setDeleteId(w.id)}><Trash2 size={16}/></button></article>) : <div className="empty-state">Le tue sessioni appariranno qui, una volta registrate.</div>}<DataManagement workouts={workouts}/></section>}
      {tab === 'progress' && <section><div className="eyebrow">DATI, NON SENSAZIONI</div><h1>Progressi<span>.</span></h1><ProgressDashboard workouts={workouts}/></section>}
    </main>
    <nav className="bottom-nav">{tabs.map(({id,label,icon:Icon})=><button key={id} className={tab===id?'nav-item active':'nav-item'} onClick={()=>setTab(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {showEmom && <EmomRunner onClose={()=>setShowEmom(false)}/>}
    {editing && <WorkoutEditor workout={editing} onChange={setEditing} onClose={()=>setEditing(null)} onSave={()=>void saveEdit()}/>}
    {deleteId && <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>Eliminare la sessione?</h2><button className="close-button" onClick={()=>setDeleteId(null)}>×</button></div><p className="muted">Questa azione non può essere annullata.</p><div className="form-grid"><button className="secondary-button" onClick={()=>setDeleteId(null)}>ANNULLA</button><button className="primary-button" onClick={()=>void deleteWorkout()}>ELIMINA</button></div></div></div>}
    {showQuickLog && <WorkoutLogger workouts={workouts} dayLabel={today.label} onClose={()=>setShowQuickLog(false)} onSave={async entry=>{await db.workouts.add(entry)}}/>}
  </div>
}

function WorkoutEditor({workout,onChange,onClose,onSave}:{workout:WorkoutLog;onChange:(w:WorkoutLog)=>void;onClose:()=>void;onSave:()=>void}) {
  const patch=(id:string,values:Partial<SetLog>)=>onChange({...workout,setLogs:workout.setLogs.map(s=>s.id===id?{...s,...values}:s)})
  return <div className="modal-backdrop" onClick={onClose}><div className="modal editor-modal" onClick={e=>e.stopPropagation()}>
    <div className="modal-head"><div><div className="eyebrow">MODIFICA REGISTRAZIONE</div><h2>{workout.title}</h2></div><button className="close-button" onClick={onClose}>×</button></div>
    <label>Titolo<input value={workout.title} onChange={e=>onChange({...workout,title:e.target.value})}/></label>
    <label>Data<input type="date" value={workout.date} onChange={e=>onChange({...workout,date:e.target.value})}/></label>
    <div className="editor-section-title">SERIE <button className="secondary-button" onClick={()=>onChange({...workout,setLogs:[...workout.setLogs,{id:crypto.randomUUID(),exerciseId:'pull-up',variation:'Strict',addedLoadKg:0,targetReps:6,actualReps:6,rir:2,completed:true,technique:'good',notes:'',createdAt:Date.now()}]})}>+ AGGIUNGI SERIE</button></div>
    {workout.setLogs.map((s,i)=><div className="set-editor" key={s.id}><div className="plan-day-head"><strong>Serie {i+1}</strong><button className="icon-button danger" onClick={()=>onChange({...workout,setLogs:workout.setLogs.filter(x=>x.id!==s.id)})}><Trash2 size={15}/></button></div>
      <label>Esercizio<select value={s.exerciseId} onChange={e=>patch(s.id,{exerciseId:e.target.value as ExerciseId})}>{EXERCISES.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Variante<input value={s.variation} onChange={e=>patch(s.id,{variation:e.target.value})}/></label>
      <div className="form-grid"><label>Target<input type="number" min="0" value={s.targetReps} onChange={e=>patch(s.id,{targetReps:Math.max(0,Number(e.target.value))})}/></label><label>Effettive<input type="number" min="0" value={s.actualReps} onChange={e=>patch(s.id,{actualReps:Math.max(0,Number(e.target.value))})}/></label></div>
      <div className="form-grid"><label>Zavorra<select value={s.addedLoadKg} onChange={e=>patch(s.id,{addedLoadKg:Number(e.target.value)})}>{VALID_LOADS_KG.map(v=><option key={v} value={v}>{v} kg</option>)}</select></label><label>RIR<input type="number" min="0" max="10" value={s.rir ?? ''} onChange={e=>patch(s.id,{rir:e.target.value===''?null:Number(e.target.value)})}/></label></div>
      <label>Tecnica<select value={s.technique} onChange={e=>patch(s.id,{technique:e.target.value as SetLog['technique']})}><option value="good">Buona</option><option value="degraded">Degradata</option><option value="pain">Dolore</option></select></label><label>Note<input value={s.notes} onChange={e=>patch(s.id,{notes:e.target.value})}/></label>
    </div>)}
    <label>Note sessione<input value={workout.notes} onChange={e=>onChange({...workout,notes:e.target.value})}/></label><label>Dolore / fastidi<input value={workout.pain} onChange={e=>onChange({...workout,pain:e.target.value})}/></label>
    <button className="primary-button full" onClick={onSave}>SALVA MODIFICHE</button>
  </div></div>
}

function Stat({label,value}:{label:string;value:string}) { return <div className="stat-card"><small>{label}</small><strong>{value}</strong></div> }
