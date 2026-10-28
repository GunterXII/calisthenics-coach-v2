import type { ExerciseId, SetLog, WorkoutLog } from '../types'
import { VALID_LOADS_KG } from '../data/program'
export interface StrengthSuggestion { title:string; detail:string; nextLoadKg?:number; nextRepTarget?:number }
export function suggestStrengthProgression(history:WorkoutLog[],exerciseId:ExerciseId,variation:string):StrengthSuggestion|null {
 const session=history.find(w=>w.setLogs.some(s=>s.exerciseId===exerciseId&&s.variation===variation))
 if(!session)return null
 const sets=session.setLogs.filter(s=>s.exerciseId===exerciseId&&s.variation===variation)
 if(!sets.length)return null
 const load=sets[0].addedLoadKg
 const clean=sets.every(s=>s.completed&&s.actualReps>=s.targetReps&&s.technique==='good'&&(s.rir??0)>=2)
 if(!clean)return {title:'Consolida il carico attuale',detail:'Non tutte le serie hanno raggiunto il target con tecnica buona e almeno 2 RIR. Ripeti il livello.'}
 const maxTarget=Math.max(...sets.map(s=>s.targetReps))
 const nextLoad=VALID_LOADS_KG.find(v=>v===load+5)
 if(maxTarget>=8&&nextLoad!==undefined)return {title:'Valuta +5 kg',detail:`Hai completato tutte le serie a ${load} kg con margine. Passa a ${nextLoad} kg e riparti da 5–6 ripetizioni.`,nextLoadKg:nextLoad,nextRepTarget:5}
 return {title:'Aumenta le ripetizioni',detail:'Mantieni il carico e aggiungi 1 ripetizione per serie nella prossima seduta.',nextRepTarget:maxTarget+1}
}
