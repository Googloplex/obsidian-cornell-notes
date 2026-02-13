# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run build` — bundle TypeScript into `main.js` via esbuild (CJS, ES2018, obsidian externalized)
- `npm run dev` — same with `--watch` for live reload during development

After build, copy `main.js` + `manifest.json` + `styles.css` into an Obsidian vault at `.obsidian/plugins/cornell-notes/` and restart Obsidian to test.

## Architecture

Obsidian plugin implementing the Cornell Note-Taking Method. Custom `.cornell` file format (JSON) with a three-panel editor UI.

**Entry point**: `main.ts` — `CornellNotesPlugin` extends `Plugin`. Registers the custom view, commands, ribbon icon, folder context menu, and settings tab.

**Modules** (`src/`):

| File | Role |
|------|------|
| `types.ts` | `CornellData` interface, constants (`CORNELL_VIEW_TYPE`, `CORNELL_EXTENSION`, `CORNELL_ICON`), JSON parse/serialize, formatting helpers |
| `view.ts` | `CornellNotesView` extends `TextFileView` — three-panel editor (cues/notes/summary), draggable divider, Tab navigation, status bar |
| `modals.ts` | `CreateCornellNoteModal` (file creation dialog), `ExportCornellNoteModal` (Markdown export with preview) |
| `settings.ts` | `CornellSettings` interface, `CornellSettingsTab` (PluginSettingTab), `generateMdContent()` for companion .md files |

**Data flow**: User edits → `this.data` updated → `requestSave()` triggers Obsidian's auto-save → `getViewData()` serializes JSON. External file changes arrive via `setViewData()` → `parseData()` → `syncDataToEditors()` updates DOM. The `isLoading` flag prevents feedback loops.

**Styling**: `styles.css` at root — pure CSS with Obsidian CSS variables, responsive layout (<600px stacks vertically), print styles. All classes prefixed with `cornell-`.

## Conventions

- UI strings in Russian
- Constants: `UPPER_SNAKE_CASE`; classes: `PascalCase`; functions: `camelCase`; CSS: `cornell-` prefixed kebab-case
- DOM built with Obsidian's `createEl()`/`createDiv()` helpers, no UI frameworks
- Uses `requestSave()` (Obsidian's debounced save), not direct `vault.modify()`
- Section dividers in code use box-drawing characters (═, ─)
