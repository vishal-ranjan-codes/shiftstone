# OKLCH Color Space Science & Curated Archetype Palettes

Perceptually uniform color systems calibrated for digital product interfaces across light and dark modes.

---

## Why OKLCH?

Legacy color spaces (RGB, HSL, Hex) suffer from **non-uniform perceptual lightness**:
- In HSL, `hsl(60, 100%, 50%)` (yellow) is perceptually blindingly bright, whereas `hsl(240, 100%, 50%)` (blue) is perceptually dark, despite both claiming 50% lightness.
- **OKLCH** separates Lightness ($L \in [0.0, 1.0]$), Chroma ($C \in [0.0, 0.4]$), and Hue ($H \in [0^\circ, 360^\circ]$).
- A lightness value of $L = 0.65$ has identical perceived luminance regardless of hue angle, guaranteeing consistent WCAG contrast across all brand colors.

---

## Contrast Requirements Matrix

| Surface Pairing | Minimum Ratio (WCAG AA) | Enhanced Ratio (WCAG AAA) | APCA Target |
|---|---|---|---|
| Large Text ($\ge 18\text{pt}$ or $\ge 14\text{pt}$ bold) | $3.0 : 1$ | $4.5 : 1$ | $L^c \ge 60$ |
| Body Text ($< 18\text{pt}$) | $4.5 : 1$ | $7.0 : 1$ | $L^c \ge 75$ |
| UI Components & Borders | $3.0 : 1$ | $4.5 : 1$ | $L^c \ge 45$ |

---

## Curated OKLCH Palettes by Brand Mood

### 1. Electric Sapphire (Developer Tooling / Enterprise SaaS)
- **Primary 500:** `oklch(0.62 0.22 260)` (#4f46e5 analogue)
- **Primary 600 (Dark Mode Accent):** `oklch(0.68 0.24 260)`
- **Neutral Surface (Light):** `oklch(0.98 0.01 250)` (#f8fafc)
- **Neutral Surface (Dark):** `oklch(0.16 0.02 250)` (#0f172a)
- **Neutral Border:** `oklch(0.88 0.02 250)` (Light) / `oklch(0.26 0.02 250)` (Dark)

### 2. Algorithmic Emerald (Fintech / Growth / Data Platforms)
- **Primary 500:** `oklch(0.65 0.20 155)` (#10b981 analogue)
- **Primary 600 (Dark Mode Accent):** `oklch(0.72 0.22 155)`
- **Neutral Surface (Light):** `oklch(0.98 0.01 160)` (#f8faf9)
- **Neutral Surface (Dark):** `oklch(0.15 0.02 160)` (#091410)
- **Neutral Border:** `oklch(0.89 0.02 160)` (Light) / `oklch(0.25 0.02 160)` (Dark)

### 3. Solar Amber & Obsidian (Hardware / Industrial / Creative Tools)
- **Primary 500:** `oklch(0.70 0.19 55)` (#f59e0b analogue)
- **Primary 600 (Dark Mode Accent):** `oklch(0.76 0.20 55)`
- **Neutral Surface (Light):** `oklch(0.98 0.01 60)` (#fdfbf7)
- **Neutral Surface (Dark):** `oklch(0.14 0.01 60)` (#171614)
- **Neutral Border:** `oklch(0.87 0.02 60)` (Light) / `oklch(0.27 0.02 60)` (Dark)

### 4. Monochromatic Carbon (Precision Editorial / Minimalist Security)
- **Primary 500 (Light / Dark Inverted):** `oklch(0.20 0.01 0)` / `oklch(0.96 0.01 0)`
- **Neutral Surface (Light):** `oklch(0.99 0.00 0)` (#ffffff)
- **Neutral Surface (Dark):** `oklch(0.12 0.00 0)` (#0a0a0a)
- **Neutral Border:** `oklch(0.88 0.00 0)` (Light) / `oklch(0.24 0.00 0)` (Dark)
