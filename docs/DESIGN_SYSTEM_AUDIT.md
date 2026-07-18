# Luna global design-system audit

Date: 2026-07-18

## Before the correction

- Fonts loaded: Inter (400–700), Playfair Display (600–700), Georgia fallbacks, and platform system sans-serif fallbacks.
- Heading systems: Home used a bold Inter hero; Library used `luna-editorial-title`; Journey and several factual data sections used Playfair; Profile, Premium, players, sheets, and admin used independent Tailwind sizes.
- Repeated surfaces: Home recommendation/continue/discovery cards, Library rows, Chat recommendation cards, Journey sections, Profile settings, pricing plans, and empty states each defined separate radii, borders, spacing, and elevation.
- Repeated colors: the main `--luna-*` variables, Home `--v2-*` variables, Journey `--v2-*` variables, and many close-but-not-identical inline navy, violet, gold, ivory, and border values.
- Icons: Lucide was the main family, mixed with emoji mood symbols, a custom CSS crescent, a standalone crescent SVG, and star glyphs.
- Layout workarounds: the app shell used page-specific Tailwind bottom padding; Chat subtracted a hard-coded `148px` from a visual viewport variable; its composer added a separate safe-area margin; Home and Journey had their own navigation and bottom-clearance assumptions.
- Legacy brand assets: `frontend/public/luna-avatar.png`, `website/public/luna-avatar.png`, `frontend/public/assets/icons/luna-crescent-icon.svg`, and `luna-icon-{192,512,1024}.png`. Production references existed in the shared header, Profile fallback, Home Screen card, empty/loading states, website previews, favicon, Apple touch icon, and PWA manifest.

## Final system

- Inter is the primary interface family for page titles, section titles, cards, metrics, navigation, filters, buttons, descriptions, and players.
- Playfair Display is available only through the editorial token for Luna reflection, the Premium campaign headline, and a major Garden stage statement.
- `design-system/tokens.css` owns colors, typography, spacing, radii, borders, shadows, glows, controls, icon sizes, motion, safe areas, viewport height, page gutters, card padding, and navigation geometry.
- Shared production primitives: `AppHeader`, `PageHeader`, `SegmentedTabs`, `BottomNavigation`, `BrandLogo`, `MeditationCard`, and `ChatMeditationCard`.
- The official supplied artwork is preserved unchanged as `luna-logo-original-v2-20260718.png`; versioned derivatives cover the app mark, favicon, Apple touch icon, and 192/512/1024 PWA outputs.
- The old CSS crescent and legacy icon paths have no production references. Versioned filenames plus a versioned manifest URL prevent existing clients from retaining the old artwork. The repository contains no service worker, so there is no service-worker cache key to rotate.
- A single app shell now uses Telegram safe-area variables, `visualViewport`, Telegram `viewportChanged`, dynamic viewport height, a keyboard inset, one navigation height, and one content clearance.
- Chat uses a flexible message viewport, zero composer/navigation gap, keyboard-aware navigation hiding, horizontally snapping prompt chips, one recommendation card, and explicit stale-action clearing semantics.
- Library filters use a masked horizontal rail with snap padding and 44px targets. Home and Library share human-readable rounded-minute duration formatting.
- Journey labels active days consistently, explains that check-ins or completed listening count, preserves missing mood data, marks today, keeps exact line/legend colors, and supplies a screen-reader chart summary.
