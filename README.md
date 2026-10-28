# Calisthenics Coach V2

Personal, offline-first training tracker for calisthenics.

## Stack
React, TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), Recharts, Lucide.

## Development
```bash
npm install
npm run dev
```

## Product principles
- Local-first: workouts remain usable without a network connection.
- Training records are editable and drive all derived statistics.
- EMOM prescriptions are snapshots: editing a template never rewrites history.
- Progression is advisory; the athlete confirms every change.
- Added load is limited to the actual plate inventory: 0, 5, 10, 15, 20, 25, 30 kg.

See [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) for the functional specification.
