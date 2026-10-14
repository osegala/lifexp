# Phase 4 — Shop review

Reviewed October 13, 2026. GO for review.

## Audit and existing behavior

- Route: `app/(tabs)/shop.tsx`.
- Catalog, order, effective price, player Coins, level, ownership, purchase
  eligibility and lock state come from GET `/shop`.
- Purchase sends only `{ itemId }` to POST `/shop/purchase`, then reloads `/shop`
  and refreshes the profile. The response's catalog remains authoritative.
- Insufficient funds uses `NOT_ENOUGH_COINS` and `canPurchase`; achievement and
  level locks include the existing requirement/progress text.
- Premium state comes from the existing `useEntitlements` hook. View Premium
  retains the `/premium` route.
- The banner and rewarded CTA follow the catalog in that order. The rewarded
  callback replaces Coins with `result.coins` and refreshes the profile. It does
  not add coins locally or grant a reward.
- Original failures used native Alerts. Those remain, with inline accessible
  errors/retry added for the redesigned screen; failed reads retain the catalog.
- Previews use the shared catalog reference, preview source, and crop helpers.
- There was no item detail modal, selection/equipped state, or category filter in
  this branch. No equipment endpoint/read or invented equipped badge was added.

The starting working tree had an eager ScrollView rather than the optimization
described in the brief. A broader history search found the optimization in saved
WIP snapshot `5ea8e64f`: FlatList, six initial items, batches of four, window five,
memoized cards, and expo-image memory/disk previews. Only those relevant Shop
performance choices were recovered; no other WIP/avatar changes were applied.

## Final presentation and performance

Shop uses the shared parchment surfaces, forest controls, gold coin treatment,
typography, spacing, resource pills, badges and focus treatment. Only Coins are
displayed. Unknown balance is shown as an em dash, not an invented zero.

All is the default view, preserving the original full catalog and server order.
Category chips are derived from the actual `item.category` values in first-seen
order. They perform exact category filtering without sorting or inventing a
category taxonomy. The catalog snapshot has tunic, hat, pet, pants, boots, aura,
and background. The category strip scrolls horizontally inside the list header.

The vertical screen is one FlatList, not a list nested in a vertical ScrollView.
It uses stable item IDs, memoized cards and stable purchase callbacks. Its
`windowSize` is 5. FlatList counts rows for multi-column rendering, so initial
rows are `ceil(6 / columns)` and batches are `ceil(4 / columns)`: still six initial
previews and four previews per batch. No fixed item-height assumptions were added.

At widths below 360px or font scale >= 1.5, the grid uses one column. Otherwise
it uses two columns within the shared 720px content maximum. Transparent master
art is unchanged; the existing source/crop geometry is preserved with contain
rendering and no image transition. `CosmeticImage` enables memory/disk caching
only when its new optional `cached` prop is supplied by ShopItemCard. The default
React Native Image path and Avatar wardrobe caller remain unchanged. There is no
image recycling key or layered-avatar change.

Cards show the server price or Owned state, Premium/lock information, achievement
progress, and existing purchase labels. Disabled items retain readable text.
Already-owned Premium items stay Owned even for a Free account. The client does
not re-evaluate entitlement expiry or alter inventory/equipment.

The actual BannerAdPlacement/RewardedAdButton components and their eligibility,
consent, ad-unit, SSV, daily-limit and confirmation code were not changed. They
remain list-footer children in the same order. Premium/unknown-state suppression
is still owned by the existing Ads provider.

## Validation and local review

- `npm test`: 249 passed, 0 failed, 0 skipped.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, no lint warnings.
- `git diff --check`: passed.
- Eight focused Shop regressions cover catalog/categories/order, lazy list limits
  and keys, effective prices, purchase flags, insufficient funds, locks/permanent
  ownership, footer order, loading/errors/retry, crop/cache geometry, pending and
  failed purchases, and authoritative ownership/balance refresh.
- Existing entitlement, ad/reward, API contract and asset mapping tests remain
  passing; assertions were moved to the new presentation seam where needed.

The isolated `shop-preview.tsx` entry renders the actual ShopContent and cards
with an October 13 seed-metadata snapshot and explicitly labeled fixture states.
The snapshot lives in the DEV preview because Metro cannot import the backend
directory outside the frontend project root. No account/API/billing/ad requests
are made. Production Shop continues to use GET `/shop` only.

Local web review passed at 320, 390, 768 and 1024px. The 320px layout is one column;
390px and wider are two columns. Real long product names wrap, artwork remains
contained, horizontal category navigation works, and a ten-digit balance fits.
The initial composition showed six preview nodes; after windowing settled it
showed twelve rather than all 85 catalog images. This is a web observation, not
an Android memory benchmark.

Reviewed Owned, insufficient funds, Premium locks/eligibility, achievement locks,
loading, empty, errors, retry, pending purchase and confirmed ownership states.
Keyboard purchase, category selection and retry work, selected state is exposed,
focus is visible, error text has alert semantics, and visible controls meet the
44px target check. Existing token contrast coverage passes. The last rewarded
CTA ends at 731px with the tab bar beginning at 785px in the 390px footer review.
The browser review reported no console errors.

Remaining device checks: signed-in Android/iOS behavior, native safe areas,
screen readers, large native text and Android cache/scroll performance. The
existing renderer investigation is outside this phase. No new dependency or
native/configuration change was made.

## Phase 4 files

- `app/(tabs)/shop.tsx`
- `src/components/ShopContent.tsx`
- `src/components/ShopItemCard.tsx`
- `src/components/CosmeticImage.tsx`
- `src/dev/ShopPreview.tsx`
- `shop-preview.tsx`
- `tests/shop-redesign.test.mjs`
- `tests/entitlements-ads.test.mjs` (Shop footer assertions)
- `tests/rewarded-ads.test.mjs` (authoritative callback presentation seam)
- `tests/avatar-wardrobe.test.mjs` (shared Shop mapping location)
- `tests/frontend-api-contract.test.mjs` (Shop card presentation assertions)
- `docs/shop-phase4.md`

Earlier Phase 1–3 working-tree changes were retained. No backend, native, auth,
monetization rules, avatar internals, PNGs, or dependencies changed. No commit,
push, deployment, AWS access or native build was performed.

Phase 5 recommendation: Avatar shell redesign using shared surfaces/navigation
around the existing renderer and wardrobe, preserving geometry, appearance,
equipment mutations and rendering internals.
