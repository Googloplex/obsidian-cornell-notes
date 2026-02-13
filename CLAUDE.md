# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run build` — bundle TypeScript into `main.js` via esbuild (CJS, ES2018, obsidian + @codemirror/* externalized)
- `npm run dev` — same with `--watch` for live reload during development
- `npm run deploy` — build, copy to vault, restart Obsidian (Windows-specific paths in `scripts/deploy.js`)

After build, copy `main.js` + `manifest.json` + `styles.css` into an Obsidian vault at `.obsidian/plugins/cornell-notes/` and restart Obsidian to test.

## Architecture

Obsidian plugin implementing the Cornell Note-Taking Method. Each note is a **folder** containing:
- `.cornell` manifest (JSON: title, tags, timestamps) — opens the custom 3-panel view
- `name_cues.md`, `name_notes.md`, `name_summary.md` — real .md files with YAML frontmatter

**Entry point**: `main.ts` — `CornellNotesPlugin` extends `Plugin`. Creates folder structure (subfolder + 3 .md + .cornell manifest), registers view, commands, ribbon icon, context menu, settings tab. Auto-creates root notes folder (`ensureRootFolder()`) on startup via `onLayoutReady()`.

**Modules** (`src/`):

| File | Role |
|------|------|
| `types.ts` | `CornellManifest` interface, `SECTIONS` map (key→suffix+label), `SectionKey` type, frontmatter generation/stripping, path helpers, formatting utils |
| `embedded-editor.ts` | `EmbeddableMarkdownEditor` — lazy factory wrapping Obsidian's internal `ScrollableMarkdownEditor` prototype (CM6 Live Preview). Adapted from [Fevol's gist](https://gist.github.com/Fevol/caa478ce303e69eabede7b12b2323838) / obsidian-kanban |
| `view.ts` | `CornellNotesView` extends `TextFileView` — reads .cornell manifest, loads 3 .md files into embedded CM6 editors with Live Preview (wikilinks, embeds, LaTeX rendered inline). Debounced save, external change detection, Tab navigation between panels, Shift+Tab inserts tab, draggable horizontal divider for summary resize |
| `modals.ts` | `CreateCornellNoteModal` (name+folder dialog), `AggregateCornellModal` (reads 3 sections, combines into single Markdown with preview/copy/export) |
| `settings.ts` | `CornellSettings` (defaultFolder, default `"Cornell Notes"`), `CornellSettingsTab`. Changing folder triggers `ensureRootFolder()` |

**Data flow**:
- `.cornell` manifest: loaded via `setViewData()` → `parseManifest()`, saved via `getViewData()` → `serializeManifest()`, auto-saved with `requestSave()`
- Section .md files: loaded via `vault.read()` → `stripFrontmatter()`, fed into embedded CM6 editor. On change: debounced `vault.modify()` (1s) with frontmatter preserved. On blur: immediate flush. External changes detected via `vault.on("modify")` event with `panel.saving` guard to prevent save-reload loops
- Editing: always-on CM6 Live Preview — no mode switching. `EmbeddableMarkdownEditor` provides full Obsidian editor experience (syntax highlighting, wikilinks, embeds, LaTeX)

**Styling**: `styles.css` — pure CSS with Obsidian variables. Embedded CM6 editors styled via `.cornell-panel-content .cm-editor` / `.cm-scroller` / `.cm-placeholder`. Vertical divider (`.cornell-divider`) between cues/notes, horizontal divider (`.cornell-divider-horizontal`) above summary for drag resize.

**Dependencies**: `monkey-around` (bundled, runtime) for safe `workspace.setActiveLeaf` patching. `obsidian-typings` (devDep) for internal API types. `@codemirror/state` and `@codemirror/view` marked external (provided by Obsidian).

## Conventions

- UI strings in Russian
- Constants: `UPPER_SNAKE_CASE`; classes: `PascalCase`; functions: `camelCase`; CSS: `cornell-` prefixed kebab-case
- DOM built with Obsidian's `createEl()`/`createDiv()` helpers, no UI frameworks
- Manifest uses `requestSave()` (Obsidian's debounced save); section .md files use direct `vault.modify()`
- Section dividers in code use box-drawing characters (═, ─)
- Section file naming: `{noteName}_{sectionKey}.md` (e.g. `Лекция_cues.md`)
