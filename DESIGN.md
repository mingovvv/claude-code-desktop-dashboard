# Design System — Claude Dashboard

APP UI 타입. 정보 밀도 우선, 장식 최소화.

## Typography

- **Font:** Inter (번들 포함 — `@fontsource/inter`)
- **Weights used:** 400 (body), 500 (label), 600 (heading), 700 (bold value)
- **Scale:**
  - `text-xs` (11–12px) — timestamps, subtitles, badges
  - `text-sm` (14px) — body, list items, labels
  - `text-base` (16px) — standard prose (rarely used)
  - `text-xl` (20px) — page headings
  - `text-2xl` (24px) — metric values (StatCard)

## Color Tokens

Defined in `src/index.css` as CSS custom properties.

### Surfaces
| Token | Tailwind equiv | Use |
|-------|----------------|-----|
| `--bg-app` | `slate-950` / `#0f172a` | App background, sidebar |
| `--bg-card` | `slate-800` / `#1e293b` | Cards, panels |
| `--bg-elevated` | `slate-700` / `#334155` | Hover states, input backgrounds |

### Borders
| Token | Value | Use |
|-------|-------|-----|
| `--border` | `slate-700/50` | Default card / panel border |
| `--border-solid` | `slate-700` | Input border, dividers |

### Text
| Token | Tailwind equiv | Use |
|-------|----------------|-----|
| `--text-primary` | `white` | Headings, metric values |
| `--text-secondary` | `slate-200` | Body text, list items |
| `--text-muted` | `slate-400` | Labels, hints, nav items |
| `--text-faint` | `slate-500` | Timestamps, subtitles, axis ticks |

### Accent (use sparingly)
| Token | Tailwind equiv | Use |
|-------|----------------|-----|
| `--accent` | `violet-600` | Charts, budget gauge, active badge |
| `--accent-hover` | `violet-700` | Hover on accent elements |

> **Rule:** Accent is NOT for nav active state or primary buttons. Use `slate-700` bg + white text for nav active state. Reserve violet for data visualization only.

### Semantic
| Token | Value | Use |
|-------|-------|-----|
| `--cost-positive` | `emerald-400` | Cost values, positive metrics |
| `--status-active` | `emerald-400` | Active session indicator dot |
| `--status-idle` | `amber-400` | Idle session indicator dot |
| `--status-error` | `red-400` | Error states |
| `--warning-bg/border/text` | amber family | parseErrors banner |

## Component Patterns

### StatCard
- No icon container (no colored circle). Icon rendered directly in `--text-muted`.
- Value: `text-2xl font-bold` + `--text-primary`
- Label: `text-xs` + `--text-muted`
- Sub: `text-xs` + `--text-faint`

### Navigation (sidebar)
- Active state: `bg-slate-700 text-white` — NOT violet
- Inactive: `--text-muted`, hover `bg-slate-800`
- Badge (active session count): `bg-amber-500 text-white`

### Cards
- Background: `--bg-card` (`bg-slate-800`)
- Border: `border --border` (`border-slate-700/50`)
- Border radius: `rounded-xl`
- Padding: `p-4`

### Charts (recharts)
- Grid: `stroke="#334155"` (`--border-solid`)
- Axis ticks: `fill="#64748b"` (`--text-faint`)
- Area/Bar fill: `--accent` (violet-600 / #7c3aed)
- Tooltip bg: `--bg-card` (#1e293b)

## Spacing Scale

| Usage | Value |
|-------|-------|
| Tight (between icon and text) | `gap-1.5`, `gap-2` |
| Card inner padding | `p-4` |
| Page padding | `p-6` |
| Section gap | `space-y-6` |
| List item gap | `space-y-2`, `divide-y` |

## Anti-patterns (AI Slop Blacklist)

- ❌ Colored circle + icon in stat cards → icon only
- ❌ Violet as primary nav active color → use slate-700
- ❌ Purple/violet gradient backgrounds
- ❌ Centered text for all headings
- ❌ Emoji as UI elements
- ❌ Decorative blob / wavy dividers
