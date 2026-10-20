---
name: Atelier Noir
colors:
  surface: '#151314'
  surface-dim: '#151314'
  surface-bright: '#3b3839'
  surface-container-lowest: '#100e0f'
  surface-container-low: '#1d1b1c'
  surface-container: '#211f20'
  surface-container-high: '#2c292a'
  surface-container-highest: '#373435'
  on-surface: '#e7e1e2'
  on-surface-variant: '#dbc0c2'
  inverse-surface: '#e7e1e2'
  inverse-on-surface: '#323031'
  outline: '#a38b8c'
  outline-variant: '#554243'
  surface-tint: '#ffb2b9'
  primary: '#ffb2b9'
  on-primary: '#601122'
  primary-container: '#6b1a2a'
  on-primary-container: '#f0818f'
  inverse-primary: '#9c404e'
  secondary: '#e4c285'
  on-secondary: '#412d00'
  secondary-container: '#5d4514'
  on-secondary-container: '#d5b478'
  tertiary: '#99d3b5'
  on-tertiary: '#003825'
  tertiary-container: '#00422c'
  on-tertiary-container: '#76af92'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdadc'
  primary-fixed-dim: '#ffb2b9'
  on-primary-fixed: '#400010'
  on-primary-fixed-variant: '#7e2837'
  secondary-fixed: '#ffdea4'
  secondary-fixed-dim: '#e4c285'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5a4312'
  tertiary-fixed: '#b4f0d0'
  tertiary-fixed-dim: '#99d3b5'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#155039'
  background: '#151314'
  on-background: '#e7e1e2'
  surface-variant: '#373435'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 38px
    fontWeight: '400'
    lineHeight: 46px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 36px
    letterSpacing: 0em
  headline-md:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
    letterSpacing: 0em
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 30px
    letterSpacing: 0em
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '300'
    lineHeight: 26px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '300'
    lineHeight: 22px
    letterSpacing: 0.01em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.14em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-desktop: 2.5rem
  margin: 1.25rem
  margin-desktop: 4rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.75rem
  space-xl: 3rem
---

## Brand & Style

The design system embodies the understated discipline of quiet luxury, bespoke digital tailoring, and curated editorial publishing. Built for an intelligent personal wardrobe atelier, the aesthetic avoids loud digital cliches, aggressive gradients, and fast-fashion gamification. Instead, it mirrors the atmosphere of a private salon: calm, deliberate, and deeply discerning.

### Visual Style
The aesthetic fuses high-fashion editorial minimalism with modern dark-mode tactility:
- **Quiet Luxury Minimalism:** Deep, warm near-black voids anchor the canvas, allowing garments and styling palettes to command full focus.
- **Editorial Typography:** High-contrast serif headlines pair with crisp, utilitarian sans-serif UI type to balance classical couture authority with effortless digital execution.
- **Micro-Refinement:** Fine hairline borders, controlled glass backdrops, restrained champagne-brass micro-accents, and generous negative space communicate exclusivity and precision.

## Colors

The palette is anchored in shadow, fine vintage wine, and warm antique paper:

### Palette Roles
- **Canvas Base (`#0E0C0D`):** A warm near-black providing deep velvet contrast without the clinical starkness of pure digital black (`#000000`).
- **Surface Tier 1 (`#1A1718`):** Deep charcoal for default cards, sheets, and modular containers.
- **Surface Tier 2 (`#221E20`):** Elevated charcoal for interactive card states, elevated modals, flyouts, and dropdowns.
- **Primary Brand Accent (`#6B1A2A`):** Deep vintage burgundy reserved for focal CTAs, active selections, and refined hero elements.
  - Hover / Pressed: `#4A0F1C`
  - Subtle Wash / Fill: `#2E181D` (20–40% opacity for badge fills and focused field backgrounds)
- **Secondary Accent (`#C9A96E`):** Antique brass/gold used sparingly for score badges, curation marks, and verified styling status.
- **Text Primary (`#F2EDE4`):** Warm ivory to prevent eye fatigue while offering high legibility against charcoal surfaces.
- **Text Secondary (`#A89F96`):** Muted taupe for metadata, secondary navigations, and inactive icons.
- **Structural Dividers & Outlines (`#2E2426`):** Dark burgundy-tinted gray used for 1px structural framing, keeping borders present yet whisper-soft.

## Typography

The type system creates an intentional dialogue between the classical heritage of print fashion magazines and pristine screen legibility:

- **Serif Display & Headlines (`Playfair Display`):** Reserved for lookbook titles, wardrobe curation highlights, narrative outfit analysis, and section intros. Use light to medium weights; avoid heavy bolds to maintain airiness and refinement.
- **Sans-Serif Core (`Inter`):** Deployed for all metadata, technical specs, fabric descriptions, and UI controls. Body weights default to `300` (Light) for an open, airy visual rhythm, paired with an expansive line height.
- **Editorial Micro-Caps (`label-caps`):** Category tags, collection dates, and step counters should be set in full uppercase with wide `0.14em` letter-spacing to evoke boutique garment tagging and couture run-sheets.

## Layout & Spacing

The layout treats screen real estate like an art catalog, relying on breathing room to convey exclusivity:

### Grid Architecture
- **Desktop (12 Columns):** Fluid with max canvas width capped at `1440px`. Column gutters expand to `2.5rem` (`40px`) with outer canvas margins of `4rem` (`64px`), establishing wide breathing borders around lookbooks and wardrobes.
- **Tablet (8 Columns):** Standardized `1.5rem` (`24px`) gutters and margins.
- **Mobile (4 Columns):** Strict `1.25rem` (`20px`) outer margin with `1rem` (`16px`) gutters. Editorial headers downscale gracefully while spacing preserves clear separation between stacked looks.

### Spacing Discipline
- Maintain generous vertical padding within interactive cards and detail views.
- Group related garment metadata using `space-xs` and `space-sm`, but isolate distinct outfit assemblies with `space-xl` to honor individual compositions.

## Elevation & Depth

Visual hierarchy is constructed through tonal stratification, razor-sharp hairline boundaries, and translucent surface blurs rather than heavy, drop-shadow projections.

### Surface Stratification
- **Ground Floor:** `#0E0C0D` background canvas.
- **Card & Tier 1 Modules:** `#1A1718` paired with a crisp `1px solid #2E2426` border.
- **Floating Modals & Flyouts:** `#221E20` backed by a 16px Gaussian blur (`backdrop-filter: blur(16px)`) with 85% opacity, creating an optical frost effect over layered garment images.

### Ambient Illumination
Avoid pitch-black drop shadows. For elevated drawers, contextual menus, and dragging item states, utilize soft ambient blooms tinted in deep burgundy:
- **Elevated Float:** `0 12px 36px -8px rgba(14, 12, 13, 0.8), 0 0 20px 0 rgba(107, 26, 42, 0.08)`
- **Hairline Accentuation:** All elevated panels must maintain their `1px` structural outline in `#2E2426` to keep silhouette edges razor-sharp.

## Shapes

The geometric vernacular favors architectural precision over bubbly consumer app curves:

- **Controlled Softness (Level 1):** Interactive cards, modal viewports, input containers, and wardrobe tiles maintain micro-radii of `0.25rem` (`4px`). This subdues the harshness of pure right angles while sustaining the crisp discipline of high-end tailoring.
- **Curated Exceptions:**
  - Color swatch indicators, material dots, and status indicator pips are rendered as pure circles (`border-radius: 9999px`).
  - Capsule pill tags (`border-radius: 9999px`) are reserved exclusively for styling score badges (e.g., "98% Harmony") and season labels.

## Components

### Buttons
- **Primary Action:** Solid deep burgundy (`#6B1A2A`) with warm ivory text (`#F2EDE4`). Flat finish, 1px subtle border (`#8E2B3E`), no pill curves. Hover shifts to dark burgundy (`#4A0F1C`).
- **Secondary / Outline:** Transparent fill, `1px solid #2E2426`, warm ivory text (`#F2EDE4`). Hover introduces subtle burgundy tint fill (`#2E181D`) with border brightening to `#6B1A2A`.
- **Text / Editorial Action:** Taupe text (`#A89F96`) with uppercase tracking (`label-caps`). Hover triggers warm ivory color shift (`#F2EDE4`) with an animated 1px underline.

### Garment & Outfit Cards
- Built on `#1A1718` with a standard `1px solid #2E2426` frame.
- Image containers feature a subtle inner shadow or neutral matte wash to showcase clothing photography seamlessly.
- Hover elevates the surface subtly to `#221E20` and shifts the border color toward subtle burgundy highlights.

### Chips & Color Swatches
- **Color Swatches:** Circular 20px indicators framed with a 1px ring offset (`box-shadow: 0 0 0 1px #0E0C0D, 0 0 0 2px #2E2426`). Active selection glows with an antique brass (`#C9A96E`) outer hairline ring.
- **Filter Chips:** Minimalist rectangular containers with `4px` corner radii. Unselected: `#1A1718` background, `#A89F96` text. Selected: `#2E181D` background with `1px solid #6B1A2A` and `#F2EDE4` text.

### Form Inputs & Selectors
- **Input Fields:** `#141112` fill with `1px solid #2E2426`. Typography set in `Inter` 14px warm ivory. Placeholder in muted taupe (`#A89F96` at 50% opacity).
- **Focus State:** Border transitions to `#6B1A2A` accompanied by an imperceptible `0 0 0 1px #6B1A2A` inner glow. No heavy blue or system rings.

### Checkboxes & Radio Elements
- Custom 16px geometric squares (checkboxes) and circles (radios) with `1px solid #2E2426`.
- Checked state fills with `#6B1A2A` with an ivory micro-icon or dot.

### Specialized Boutique Elements
- **Harmony Score Pill:** Elevated capsule tag featuring `#2E181D` fill, a hairline border in `#C9A96E` at 40% opacity, and antique brass (`#C9A96E`) numeric text.
- **Wardrobe Grid Dividers:** Horizontal and vertical separator lines must strictly measure 1px with no drop shadow, rendered in `#2E2426`.