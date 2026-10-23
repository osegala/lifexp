# Home progression micro-polish

The existing structure is retained. This pass only adjusts supporting text, badge treatment, reward typography, and local spacing.

1. **Files changed:** [HomeContent.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/HomeContent.tsx), [QuestProgress.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/QuestProgress.tsx), [Indicators.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/ui/Indicators.tsx), [frontend-api-contract.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/frontend-api-contract.test.mjs), this report, and its review artifacts. `Indicators.tsx` accepts optional `style` and `textStyle` overrides; its existing badge palette/default styles and resource HUD components are unchanged. Only Home progression opts into the new treatments. The existing API-contract test now recognizes the nested reward label while retaining its reward-name mapping check.

2. **Reward note:** the complete explanation is preserved. It is now 12px with 17px line height in the subdued text color, aligned with the card content. The actual gaps to the streak panel and Achievements panel measure 8px each. No background, frame, or callout was added.

3. **Achievement count:** the original server-derived earned/total expression is unchanged. A 22px-tall parchment badge adds a thin warm-gold edge, 12px tabular text, and centered alignment with the heading. It has no glow or shadow.

4. **Streak status:** “✓ Today counts” uses a 22px success chip with 12px forest-green text, translucent pale backing, and a very light green edge. The check and the condition displaying it are unchanged.

5. **Reward hierarchy:** “Rewards:” is now a smaller, secondary-weight label. The original comma-separated reward names remain stronger forest text, with the same values, mapping, order, and visibility condition. No unlock, ownership, or item data changed.

6. **Status styles:** earned achievements and completed quests use the same compact success treatment as the streak. Locked achievements use a warm paper backing and muted text; their existing lock icon and full-contrast content remain. Weekly Quest’s “In progress” treatment is retained. No new state is inferred from progress.

7. **Spacing and bars:** existing four-pixel title/description spacing, eight-pixel count/bar gaps, and eight-pixel gaps between quest cards are retained. Only the supporting note gaps were tightened. All four quest/achievement bars were verified at both widths: 9px height, the same pill radius, 1px tan border (`#8B7B65`), forest track (`#35423C`), and blue fill (`#83BCD6`). The shared XPBar source was not edited.

8. **Validation:** all 282 tests pass. `npx tsc --noEmit`, `npm run lint`, and `git diff --check` pass. Browser review reported no application errors. Native device review was not run. [Validation results](/Users/owensegala/Productivity/productivity/frontend/docs/home-progression-micro-polish/validation.json).

9. **Screenshots:** [390px](/Users/owensegala/Productivity/productivity/frontend/docs/home-progression-micro-polish/home-390.jpg) and [430px](/Users/owensegala/Productivity/productivity/frontend/docs/home-progression-micro-polish/home-430.jpg). [Measured note gaps, badge sizes, and bar styles](/Users/owensegala/Productivity/productivity/frontend/docs/home-progression-micro-polish/review-measurements.json).

10. **Functionality:** unchanged. Quest/reward/streak data logic and Home event handlers match their pre-pass AST snapshots. Hero and Today markup and every pre-existing Home style are unchanged. The shared resource HUD functions, badge defaults, and XPBar are unchanged. No controller, backend, navigation, auth, notification, or other-screen files were edited. [Scope audit](/Users/owensegala/Productivity/productivity/frontend/docs/home-progression-micro-polish/scope-audit.json).

11. **Delivery:** no build, deploy, commit, or push occurred. Screenshots use the existing development Home fixture with no account or API mutation.
