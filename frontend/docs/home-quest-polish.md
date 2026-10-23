# Home progression journal refinement

The Home quest, streak, and achievement presentation changed in [QuestProgress.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/QuestProgress.tsx) and [HomeContent.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/HomeContent.tsx). Gameplay models and controllers are unchanged.

The Daily and Weekly panels reuse the established painted parchment frame with a restrained gold edge. Serif titles are 18px, padding is 12px, counts sit beside the progress bar, and status shares a footer with rewards. The existing blue fill and forest track use a nine-pixel bar with a thin tan border. Completed quests and a counted streak day reuse the existing success badge. The streak value and longest streak sit on one wrapping row.

At both 390px and 430px the normal fixture has 137px quest panels and a 117px streak panel, with no horizontal overflow. The 390px baseline measured 228px and 152px respectively. Titles, descriptions, actual counts, reward wording, current/longest streak values, and the explanatory text remain present. The hero, Today panel, navigation, and shared XPBar source were not modified by this progression refinement.

| Width | Before | Refined |
| --- | --- | --- |
| 390px | [Existing cards](/Users/owensegala/Productivity/productivity/frontend/docs/home-quest-polish/before-quests-390.jpg) | [Refined cards](/Users/owensegala/Productivity/productivity/frontend/docs/home-quest-polish/quests-390.jpg) |
| 430px | [Existing cards](/Users/owensegala/Productivity/productivity/frontend/docs/home-quest-polish/before-quests-430.jpg) | [Refined cards](/Users/owensegala/Productivity/productivity/frontend/docs/home-quest-polish/quests-430.jpg) |

[Home at 390px](/Users/owensegala/Productivity/productivity/frontend/docs/home-quest-polish/home-390.jpg) · [Home at 430px](/Users/owensegala/Productivity/productivity/frontend/docs/home-quest-polish/home-430.jpg) · [Completed fixture](/Users/owensegala/Productivity/productivity/frontend/docs/home-quest-polish/completed-390.jpg) · [Measurements](/Users/owensegala/Productivity/productivity/frontend/docs/home-quest-polish/measurements.json).

The completed fixture deliberately displays 8 / 3, a full bar, +25 earned World Points, a 9 / 15 weekly count, and a two-day streak. These are development-only sample response values used to check the requested hierarchy. Production continues to render server values unchanged, including counts above the target. The earned reward still depends on the existing granted/earned fields; completion and streak calculations are untouched.

Existing card accessibility summaries, progressbar roles/labels/value props, and readable contrast are preserved. Status uses both text and a check, independently of color. The panels wrap rather than truncate. Browser review showed no application errors; native device review was not run.

An AST comparison excluding imports, JSX, and styles confirms the data, reward, status, date, and streak expressions are unchanged. The shared XPBar file is byte-identical to the pre-pass snapshot. [Scope audit](/Users/owensegala/Productivity/productivity/frontend/docs/home-quest-polish/scope-audit.json).

The only additional source edit is a DEV Home preview state for completed-quest review in [HomePreview.tsx](/Users/owensegala/Productivity/productivity/frontend/src/dev/HomePreview.tsx). Its existing controls expose “Quest complete.” One existing test display mock was updated to recognize the shared badge; the reward/streak assertions were retained. No backend, controller, API, reward, completion, or streak logic was changed.

Achievements are now part of the same journal treatment. One painted parchment panel contains compact stacked rows with 18px serif titles, the existing trophy/lock icons, earned/locked badges, descriptions, and count/bar/reward footers. Locked rows retain full text contrast and blue progress. Each bar reads the server's `progressPercent`; counts, descriptions, rewards, summary totals, the three-item limit, and the earned flag retain their original data sources and conditions.

The normal two-row fixture is 210px tall at both 390px and 430px, compared with the 225px baseline at 390px, while adding progress bars and status badges. No horizontal overflow appeared. The content also wraps with the review text enlarged to 24px. These remain static rows with their existing read-only behavior; all Home interaction handlers are unchanged. Native device review was not run.

| Width | Achievement baseline | Unified progression |
| --- | --- | --- |
| 390px | [Before](/Users/owensegala/Productivity/productivity/frontend/docs/home-achievement-polish/before-390.jpg) | [After](/Users/owensegala/Productivity/productivity/frontend/docs/home-achievement-polish/progression-390.jpg) |
| 430px | [Before](/Users/owensegala/Productivity/productivity/frontend/docs/home-achievement-polish/before-430.jpg) | [After](/Users/owensegala/Productivity/productivity/frontend/docs/home-achievement-polish/progression-430.jpg) |

[Enlarged achievement text](/Users/owensegala/Productivity/productivity/frontend/docs/home-achievement-polish/enlarged-text-390.jpg) · [Measurements](/Users/owensegala/Productivity/productivity/frontend/docs/home-achievement-polish/measurements.json) · [Achievement scope audit](/Users/owensegala/Productivity/productivity/frontend/docs/home-achievement-polish/scope-audit.json) · [Latest validation](/Users/owensegala/Productivity/productivity/frontend/docs/home-achievement-polish/validation.json).

Only `HomeContent.tsx` changed in this achievement extension. The dashboard controller, quest component, shared XPBar, development fixture, existing event handlers, and the Home logic outside JSX/styles match their pre-extension snapshots. Browser review confirmed the fixture bars render at 100% and 72%, matching their supplied values. Existing loading, unavailable, empty, and reward states remain intact.

Validation: all 282 tests pass; TypeScript, lint, and `git diff --check` pass. [Validation results](/Users/owensegala/Productivity/productivity/frontend/docs/home-quest-polish/validation.json). No build, deploy, commit, or push occurred.

[Local Home review](http://localhost:8082/review?screen=home&width=390) · [Local review with completed-state controls](http://localhost:8082/review?screen=home&width=390&controls=1). The existing local review and Metro servers must be running.
