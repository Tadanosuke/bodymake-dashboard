<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Bodymake Project Agent Instructions

## Project Role

This repository is the mobile dashboard for 薫之介（タダノスケ）さん's 15kg weight-loss and bodymake project.

Codex must take over the same engineering and data-analysis role previously assigned to Claude Code:

- Build, fix, test, and deploy the Next.js/Vercel app.
- Preserve the app's spreadsheet contracts with Gemini Spark.
- Keep Claude, Codex, Gemini Spark, and the shared spreadsheet aligned.
- Treat `CLAUDE.md` as the Claude-facing project memory and mirror any operationally relevant rules here so Codex can act with the same assumptions.

Gemini Spark remains the main AI coach/secretary for daily conversation, meal-photo analysis, calorie/PFC calculation, daily spreadsheet management, nightly 23:30 analysis, calendar checks, and next-day workout planning.

## Shared Spreadsheet

The shared database is:

- Spreadsheet: `ボディメイク＆減量プロジェクト_総合管理シート`
- Spreadsheet ID: `1wJefKcr0S2hPcI9s7e1c89kWabnYpgQa0eg315pxtlE`
- Instruction document: `15kg減量＆ボディメイクプロジェクト_指示書`
- Instruction document ID: `1K_0vo2KIpjdZDmvC3bhLQREIQekqTSSR-gOBOd17jnY`

Important tabs:

- `ボディメイク＆減量プロジェクト_総合管理シート`: daily A-K log.
- `進捗＆予測ダッシュボード`: Gemini writes the next workout plan under `AI次回計画メニュー (YYYY/MM/DD 部位 場所)`.
- `CLAUDE_MD_MASTER`: Gemini-managed master copy of `CLAUDE.md` in A1. `npm run sync-claude` pulls it into the repo.
- `アプリ仕様_Claude→Gemini`: app/spec handoff from the engineering agent to Gemini. `npm run sync-gemini` pushes `docs/GEMINI_BRIEF.md` into this tab.

Use the spreadsheet as the coordination source for the three-tool workflow:

- Gemini Spark writes coaching data and next plans to the sheet.
- The app reads Gemini's values and writes user-entered records to the sheet.
- Claude/Codex updates the app and publishes implementation/spec changes back to Gemini through `docs/GEMINI_BRIEF.md` and `npm run sync-gemini`.

## Daily Log Contract

Daily log columns in `ボディメイク＆減量プロジェクト_総合管理シート`:

| Column | Field | Primary writer |
|---|---|---|
| A | Date `YYYY-MM-DD` | App/Gemini |
| B | Weight kg | App |
| C | Calories in | Gemini |
| D | Protein | Gemini |
| E | Fat | Gemini |
| F | Carbs | Gemini |
| G | Calories burned | Gemini |
| H | Steps | App |
| I | Workout result | App only |
| J | Other exercise | Gemini |
| K | Memo/condition | App/Gemini, segmented |

Do not blur plan and result ownership:

- Gemini owns next-day workout plans in `進捗＆予測ダッシュボード`.
- The app owns actual workout results in column I.
- Gemini must not write column I.
- The app must not overwrite Gemini-owned nutrition/exercise columns C-G and J.

Column I format written by the app:

```text
[胸]ベンチプレス: 60kg×10回, 65kg×8回 / [腕]アームカール: 12kg×12回 ｜ 計3セット/負荷量1996kg
```

Rules:

- Separate exercises with ` / `.
- Separate sets with `, `.
- Each set is `重量kg×回数回`.
- The trailing `回` is required.
- `formatWorkoutForSheet` and `parseSheetWorkout` must remain compatible as a pair.

Column K is segmented. The app writes/replaces only these leading segments:

```text
睡眠: ... / 筋肉痛: ... / 明日: ... / Gemini自由記述
```

Preserve Gemini's free text. Do not let Gemini-owned free text get erased when updating app-owned segments.

## AI Plan Contract

Gemini writes the next workout plan in any cell of `進捗＆予測ダッシュボード`. The app scans cells for this heading:

```text
AI次回計画メニュー (YYYY/MM/DD 部位 場所)
```

The plan continues from the row below the heading until the first blank row.

Expected line format:

```text
ダンベルベンチプレス: 8kg*2*10(アップ), 24kg*2*8(メイン1), 18.5kg*2*10(バックオフ) | レスト150秒
フレンチプレス(両手): 12kg*1*12 | レスト60秒
```

Rules:

- `本数` is the dumbbell count: `2` means both hands.
- Labels containing `アップ` are warm-up sets and excluded from target-rep calculation.
- Rest may be seconds or minutes, such as `レスト150秒` or `レスト2.5分`.

## Workout and Gym Rules

Absolute banned exercise:

- `ダンベルフライ` must not appear in app presets, initial exercises, or AI suggestions.

Location equipment rules:

- 赤坂店 (LifeFit): no leg curl, assisted chin-up available.
- 牛久/自宅近く店 (LifeFit): leg curl available, no assisted chin-up.

## Current App Shape

Main tabs are:

- `ホーム`
- `今日`
- `筋トレ`
- `設定`

The old `履歴` tab was removed on 2026-08-10. Workout history lives in `筋トレ`; weight/calorie trends live in `ホーム`.

The workout tab should continue to behave like an independent `筋トレMEMO`-style screen:

- Red visual style.
- Calendar/month archive.
- Total volume and workout-day stats.
- One-tap AI plan import.
- Rest timer.
- Real-time 1RM calculation: `重量 × (1 + 回数/30)`.
- Custom exercise add/delete.
- Merged history from app records and spreadsheet column I.

## Multi-User and Persistence Rules

- Each user registers their own GAS web app URL in settings.
- The server must not hold a shared spreadsheet endpoint.
- The app must work without spreadsheet connection by saving local/Firestore records.
- Spreadsheet connection enables calorie analysis and AI plan display.

Firestore constraints:

- Project: `bodymake-37d49`.
- Region: `asia-northeast1`.
- `src/lib/firestore.ts` treats `localStorage` as the source of truth and caps all Firestore calls at 6 seconds. Preserve this behavior.
- Do not call Firestore from `src/app/api/**`. API routes should proxy only to GAS.
- Server-side Firestore client SDK calls lack auth and can hang for tens of seconds before failing.

Firestore rules must be permanent authenticated user rules, not expiring test-mode rules:

```text
match /users/{uid}/{doc=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

## Required Workflow After App Changes

Whenever app behavior, features, data formats, or Gemini expectations change:

1. Update `docs/GEMINI_BRIEF.md`.
   - Feature added/removed: update section 7.
   - Data format or column ownership changed: update sections 3 and/or 4.
   - Gemini responsibilities changed: update section 9.
2. Run `npm run sync-gemini` to copy the brief to the `アプリ仕様_Claude→Gemini` spreadsheet tab.
3. Confirm the result, including updated character count.
4. Tell the user what was handed off to Gemini.

Use `npm run sync-claude` only when intentionally pulling the current `CLAUDE_MD_MASTER` A1 content into local `CLAUDE.md`.

## Development Commands

- Build: `npm run build`
- Type check: `npx tsc --noEmit`
- Sync Claude memory from spreadsheet: `npm run sync-claude`
- Push Gemini handoff brief to spreadsheet: `npm run sync-gemini`
- Generate/reuse the local sheet admin token: `npm run sheet:init-admin`
- List spreadsheet tabs through GAS: `npm run sheet:list`
- Read a spreadsheet range through GAS: `npm run sheet:read -- "シート名" "A1:K5"`
- Write one cell through GAS: `npm run sheet:write -- "シート名" "A1" "text"`
- Clear one cell/range through GAS: `npm run sheet:clear -- "シート名" "A1"`
- Write a rectangular range through GAS: `npm run sheet:write-json -- "シート名" "A1:B2" "[[1,2],[3,4]]"`
- Range read/write commands require `SHEET_ADMIN_TOKEN` in `.env.local`; the same value must be configured in Apps Script properties with `setSheetAdminToken`.
- Deploy GAS: `npm run deploy-gas`

Before modifying Next.js source code, read the relevant guide under `node_modules/next/dist/docs/` because this project uses Next.js `16.3.0` with breaking changes.

## Coordination Checklist for Future Agents

Before starting non-trivial work:

1. Read this file, `CLAUDE.md`, and `docs/GEMINI_BRIEF.md`.
2. Check `git status --short` and preserve user changes.
3. Identify whether the change affects app-only behavior or the spreadsheet/Gemini contract.
4. If the spreadsheet/Gemini contract changes, update and sync `docs/GEMINI_BRIEF.md`.
5. Keep terminology consistent:
   - `Claude Code` and `Codex` are engineering/data-analysis agents for this repo.
   - `Gemini Spark` is the daily coach and spreadsheet planner.
   - The app records actual workout results.
   - The spreadsheet coordinates all three.
