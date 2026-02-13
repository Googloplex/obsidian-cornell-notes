# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run build` — bundle TypeScript into `main.js` via esbuild (CJS, ES2018, obsidian externalized)
- `npm run dev` — same with `--watch` for live reload during development

After build, copy `main.js` + `manifest.json` + `styles.css` into an Obsidian vault at `.obsidian/plugins/cornell-notes/` and restart Obsidian to test.

## Architecture

Obsidian plugin implementing the Cornell Note-Taking Method. Each note is a **folder** containing:
- `.cornell` manifest (JSON: title, tags, timestamps) — opens the custom 3-panel view
- `name_cues.md`, `name_notes.md`, `name_summary.md` — real .md files with YAML frontmatter

**Entry point**: `main.ts` — `CornellNotesPlugin` extends `Plugin`. Creates folder structure (subfolder + 3 .md + .cornell manifest), registers view, commands, ribbon icon, context menu, settings tab.

**Modules** (`src/`):

| File | Role |
|------|------|
| `types.ts` | `CornellManifest` interface, `SECTIONS` map (key→suffix+label), `SectionKey` type, frontmatter generation/stripping, path helpers, formatting utils |
| `view.ts` | `CornellNotesView` extends `TextFileView` — reads .cornell manifest, loads 3 .md files, renders markdown via `MarkdownRenderer.render()`, click-to-edit with textarea, saves back to .md files preserving frontmatter |
| `modals.ts` | `CreateCornellNoteModal` (name+folder dialog), `AggregateCornellModal` (reads 3 sections, combines into single Markdown with preview/copy/export) |
| `settings.ts` | `CornellSettings` (defaultFolder), `CornellSettingsTab` |

**Data flow**:
- `.cornell` manifest: loaded via `setViewData()` → `parseManifest()`, saved via `getViewData()` → `serializeManifest()`, auto-saved with `requestSave()`
- Section .md files: loaded via `vault.read()` → `stripFrontmatter()`, saved via `vault.modify()` with frontmatter preserved. External changes detected via `vault.on("modify")` event
- Edit mode: click panel → show textarea with raw markdown, blur → save to .md file + re-render with `MarkdownRenderer`

**Styling**: `styles.css` — pure CSS with Obsidian variables. Key toggle: `.cornell-render` (rendered markdown, visible by default) vs `.cornell-editor` (textarea, hidden). Classes: `.cornell-render-hidden` / `.cornell-editor-hidden` control visibility.

## Conventions

- UI strings in Russian
- Constants: `UPPER_SNAKE_CASE`; classes: `PascalCase`; functions: `camelCase`; CSS: `cornell-` prefixed kebab-case
- DOM built with Obsidian's `createEl()`/`createDiv()` helpers, no UI frameworks
- Manifest uses `requestSave()` (Obsidian's debounced save); section .md files use direct `vault.modify()`
- Section dividers in code use box-drawing characters (═, ─)
- Section file naming: `{noteName}_{sectionKey}.md` (e.g. `Лекция_cues.md`)
