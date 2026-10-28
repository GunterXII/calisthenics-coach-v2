# Product specification

## Athlete profile
Goals: 30 strict pull-ups, 64 dips, 100 push-ups, 15 consecutive muscle-ups.
Available plates: 2 × 10 kg and 2 × 5 kg. Valid added-load combinations: 0, 5, 10, 15, 20, 25, 30 kg. Never infer bodyweight as added load.

## Weekly plan
- Monday — Rest.
- Tuesday — Pull strength: pull-up EMOM 10×6 BW; weighted pull-ups 1×5 @25 kg + 2×6–8 @20 kg; optional drop set every other week; chin-ups 3×8–10 @10–15 kg.
- Wednesday — Push hypertrophy: dips EMOM 10 min ×6–8 @5 kg; weighted dips 1×8–10 @25–30 kg + 2×10–12 @20 kg; optional drop set; superset weighted push-ups 12–15 @15–20 kg + diamond push-ups 8–10 BW, 3–4 rounds.
- Thursday — Rest.
- Friday — Muscle-up/power: 4 rounds of 1 muscle-up + 6–8 straight-bar dips; muscle-up EMOM 8×2 (3 only when crisp); explosive pull-ups 3–4×4–5 BW; push-up EMOM 10×10–12 @5 kg (reduce to 6–8 min if Saturday recovery suffers).
- Saturday — Weighted hypertrophy: close-grip pull-ups 4×6–8 @20 kg; paused dips 3–4×8–10 @15–20 kg; weighted push-ups 3×12–15 @15–20 kg.
- Sunday — Circuit: 3 muscle-ups, 8 pull-ups, 15 dips, 20 push-ups; 3–4 rounds, 3 min rest. Progress to 5 rounds only with clean reps.

Deload week 4: volume down 35–50%, load down 15–20%, no failure, drop sets or maximal circuit. Keep the deload editable and never suggest progression during it.
Remove pike push-ups from main sessions. Australian pull-ups are optional accessories and do not gate workout completion.

## EMOM
Duration, reps/minute, added load and variation are independent editable fields. Log every minute (target, actual, skipped/completed). Persist start/end timestamps; pause/resume must recover elapsed time from absolute timestamps, not accumulated intervals. Summary includes total/target reps, average, completed minutes, completion %, lowest minute, load, RIR and notes.

Progression rules:
1. All reps completed, good technique, RIR ≥2: suggest +1 rep/min at same load and duration.
2. Complete but RIR 0–1 or technique degraded: maintain.
3. Partial/skipped minutes or RIR 0: maintain or suggest −1 rep/min; never increase load.
4. Only after multiple clean, recovered sessions may a +5 kg step be evaluated, if inventory permits; reduce reps/min and rebuild.
5. Suggestions require explicit Accept / Keep / Edit confirmation.

## Strength sets
Prefill from the latest performance for the same exercise and variation. Record added load, target and actual reps, RIR, completion, technique, pain and notes. Support editing after workout and quick +/- controls. Use double progression (e.g. 4×8 @20 kg -> 4×5–6 @25 kg).

## Recovery and records
Track final RIR, technique, pain, fatigue and notes. Two consecutive declines, poor sleep or pain trigger a 20–30% volume-reduction warning; never silently alter the plan.
Max tests are separate from EMOM and preserve all historical records.

## Analytics and data
Charts: consecutive max tests, load/reps, weekly volume by exercise/type, EMOM filters by variation/load, activity calendar. Derive stats from source records so edits/deletions recalculate correctly.
JSON backup/restore and CSV export. Confirm before overwrite/import and destructive deletes.

## UX and technical
Mobile-first premium dark UI: #090909 background, #151515/#1D1D1D surfaces, white/gray text, #D0D4DA accent, Inter, Lucide, no emoji. Bottom navigation, safe-area support, iOS standalone PWA. No network dependency during workouts.
React + TypeScript + Vite + Tailwind, Dexie/IndexedDB, Recharts, service worker. Firebase Hosting-ready; Auth/Firestore optional later.
