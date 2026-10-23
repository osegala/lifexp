# Files changed in the material pass

Compared with the SHA-256 snapshot taken at the start of this pass. The worktree already contained two earlier visual passes and unrelated backend/billing/environment changes. Those earlier changes are not attributed to this pass.

## Source, scripts and tests

- `frontend/app/(tabs)/profile.tsx` — modified during this pass.
- `frontend/app/_layout.tsx` — modified during this pass.
- `frontend/app/onboarding.tsx` — modified during this pass.
- `frontend/app/premium.tsx` — modified during this pass.
- `frontend/scripts/audit-assets.js` — modified from clean HEAD during this pass.
- `frontend/scripts/prepare-fantasy-ui.py` — added during this pass.
- `frontend/src/components/AppearanceEditor.tsx` — modified from clean HEAD during this pass.
- `frontend/src/components/AvatarContent.tsx` — modified during this pass.
- `frontend/src/components/HomeContent.tsx` — modified during this pass.
- `frontend/src/components/LifeButton.tsx` — modified during this pass.
- `frontend/src/components/LifeCard.tsx` — modified during this pass.
- `frontend/src/components/LifeInput.tsx` — modified during this pass.
- `frontend/src/components/NotificationSettings.tsx` — modified during this pass.
- `frontend/src/components/ShopContent.tsx` — modified during this pass.
- `frontend/src/components/TaskEditor.tsx` — modified during this pass.
- `frontend/src/components/TasksContent.tsx` — modified during this pass.
- `frontend/src/components/WardrobeCard.tsx` — modified during this pass.
- `frontend/src/components/ui/AuthFrame.tsx` — modified during this pass.
- `frontend/src/components/ui/ExpandableTray.tsx` — modified during this pass.
- `frontend/src/components/ui/FantasyMaterial.tsx` — added during this pass.
- `frontend/src/components/ui/Indicators.tsx` — modified during this pass.
- `frontend/src/components/ui/PageBackground.tsx` — modified during this pass.
- `frontend/src/components/ui/PaperTexture.tsx` — modified during this pass.
- `frontend/src/components/ui/Primitives.tsx` — modified during this pass.
- `frontend/src/navigation/tabAppearance.tsx` — modified during this pass.
- `frontend/src/theme/fantasyMaterials.ts` — added during this pass.
- `frontend/src/theme/nineSlice.ts` — added during this pass.
- `frontend/tests/appearance-editor.test.mjs` — modified during this pass.
- `frontend/tests/avatar-shell.test.mjs` — modified during this pass.
- `frontend/tests/fantasy-materials.test.mjs` — added during this pass.
- `frontend/tests/notifications.test.mjs` — modified during this pass.
- `frontend/tests/onboarding.test.mjs` — modified during this pass.
- `frontend/tests/shop-redesign.test.mjs` — modified during this pass.
- `frontend/tests/task-scheduling.test.mjs` — modified during this pass.
- `frontend/tests/ui-foundation.test.mjs` — modified during this pass.

## Assets and review evidence

- Optimized runtime artwork and provenance: `frontend/assets/ui/fantasy/` (10 PNGs plus manifest).
- Updated inventory: `frontend/assets/ASSET_INVENTORY.md`.
- Retired prior procedural `frontend/assets/ui/paper-grain.png` from the runtime bundle; archived it as `frontend/docs/material-integration/retired-paper-grain.png`.
- Report and visual evidence: `frontend/docs/material-integration.md` and `frontend/docs/material-integration/`.

## Protected existing changes

All files recorded in `protected-files.json` are byte-identical to the start of this pass. Backend/billing, EAS configuration, existing environment tests, Base route/world controls, notification model, Shop item purchase component, and login/register route logic were preserved.
