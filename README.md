# Darts

Vanilla JavaScript + Tailwind CSS with Vite.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Structure

```
darts/
├── index.html          # Entry HTML
├── app.js              # Main application
├── game.js             # Game logic
├── style.css           # Tailwind styles
├── tailwind.config.js  # Tailwind configuration
├── postcss.config.js   # PostCSS configuration
├── vite.config.js      # Vite configuration
└── package.json        # Dependencies & scripts
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Build for production to `dist/` |
| `npm run preview` | Preview production build |

## Accuracy System

The game features a configurable accuracy system that simulates realistic dart throwing. Two settings control how throws can miss:

### Settings

| Setting | Range | Description |
|---------|-------|-------------|
| **Ring Accuracy** | 0-100% | Chance of hitting the intended ring (triple/double) vs falling into single |
| **Sector Accuracy** | 0-100% | Chance of hitting the intended sector vs drifting to a neighbor |

### Hit Calculation

When a throw is made, the accuracy is applied in order:

#### Regular Sectors (1-20)

1. **Sector Check** — Roll against sector accuracy
   - ✓ Hit: Stay in intended sector
   - ✗ Miss: Drift to adjacent sector (left or right, 50/50)

2. **Ring Check** (for Triple/Double throws only) — Roll against ring accuracy
   - ✓ Hit: Score the triple/double
   - ✗ Miss: Falls to single of the (potentially new) sector

#### Bull 50 (Inner Bullseye)

1. **Sector Check** — Roll against sector accuracy
   - ✓ Hit: Stay in bull area
   - ✗ Miss: Dart goes to a **random sector** (single)

2. **Ring Check** (if sector hit) — Roll against ring accuracy
   - ✓ Hit: Score 50
   - ✗ Miss: Falls to outer bull (25)

#### 25 (Outer Bull)

1. **Sector Check** — Roll against sector accuracy
   - ✓ Hit: Score 25
   - ✗ Miss: 85% chance → **random sector** (single), 15% chance → **bull 50** (lucky!)

### Examples

With Ring Accuracy: 80%, Sector Accuracy: 90%:

| Intended | Possible Outcomes |
|----------|-------------------|
| T20 | T20 (72%), T1/T5 (8%), 20 (18%), 1/5 (2%) |
| D16 | D16 (72%), D7/D8 (8%), 16 (18%), 7/8 (2%) |
| 50 | 50 (72%), 25 (18%), random single (10%) |
| 25 | 25 (90%), random single (8.5%), 50 (1.5%) |
