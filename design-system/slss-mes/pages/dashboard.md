# Dashboard Page Overrides

> **PROJECT:** SLSS MES
> **Generated:** 2026-08-02 11:48:16
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content
- **Sections:** 1. Hero (product + live preview or status), 2. Key metrics/indicators, 3. How it works, 4. CTA (Start trial / Contact)

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Dark or neutral. Status colors (green/amber/red). Data-dense but scannable.

### Component Overrides

- Avoid: Missing or incorrect viewport
- Avoid: Leave UI frozen with no feedback
- Avoid: Use 100vh for full-screen mobile layouts

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Number animations (count-up), trend direction indicators, percentage change animations, profit/loss color transitions
- Responsive: Use width=device-width initial-scale=1
- Animation: Use skeleton screens or spinners
- Layout: Use dvh or account for mobile browser chrome
- CTA Placement: Primary CTA in nav + After metrics
