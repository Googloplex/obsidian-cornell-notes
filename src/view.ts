// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — View (Three-panel editor)
// ═══════════════════════════════════════════════════════════════════════════

import { TextFileView, WorkspaceLeaf } from "obsidian";
import {
  CORNELL_VIEW_TYPE,
  CORNELL_ICON,
  CornellData,
  createEmptyData,
  parseData,
  serializeData,
  formatDate,
  countWords,
} from "./types";

export class CornellNotesView extends TextFileView {
  private data: CornellData = createEmptyData();

  // ── DOM references ──
  private cuesEditor: HTMLTextAreaElement | null = null;
  private notesEditor: HTMLTextAreaElement | null = null;
  private summaryEditor: HTMLTextAreaElement | null = null;
  private titleEditor: HTMLInputElement | null = null;
  private tagsEditor: HTMLInputElement | null = null;
  private statusBarEl: HTMLElement | null = null;

  // ── State ──
  private isLoading: boolean = false;

  // ═══════════════════════════════════════════════════════════════════════
  // TextFileView interface
  // ═══════════════════════════════════════════════════════════════════════

  getViewType(): string {
    return CORNELL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.data.title || this.file?.basename || "Cornell Notes";
  }

  getIcon(): string {
    return CORNELL_ICON;
  }

  /**
   * Called by Obsidian to get the current file content for saving.
   * This is the ONLY place where data leaves the editor → file.
   */
  getViewData(): string {
    return serializeData(this.data);
  }

  /**
   * Called by Obsidian when file content is loaded or changed externally.
   * This is the ONLY place where data enters the editor from file.
   */
  setViewData(data: string, clear: boolean): void {
    this.isLoading = true;

    this.data = parseData(data);
    this.syncDataToEditors();
    this.refreshStatusBar();

    this.isLoading = false;
  }

  clear(): void {
    this.data = createEmptyData();
    this.syncDataToEditors();
    this.refreshStatusBar();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cornell-notes-container");

    this.buildTitleBar(contentEl);
    this.buildMainArea(contentEl);
    this.buildSummaryPanel(contentEl);
    this.buildStatusBar(contentEl);
    this.setupTabNavigation();
  }

  async onClose(): Promise<void> {
    // Nothing to clean up — Obsidian handles save on close
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UI Construction
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Title + Tags bar at the top
   */
  private buildTitleBar(parent: HTMLElement): void {
    const bar = parent.createDiv({ cls: "cornell-title-bar" });

    // Title input
    this.titleEditor = bar.createEl("input", {
      cls: "cornell-title-input",
      attr: { type: "text", placeholder: "Заголовок конспекта..." },
    });
    this.titleEditor.addEventListener("input", () => {
      this.data.title = this.titleEditor!.value;
      this.onContentChanged();
    });

    // Tags input
    this.tagsEditor = bar.createEl("input", {
      cls: "cornell-tags-input",
      attr: { type: "text", placeholder: "Теги: #тег1, #тег2..." },
    });
    this.tagsEditor.addEventListener("input", () => {
      this.data.tags = this.tagsEditor!.value
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      this.onContentChanged();
    });
  }

  /**
   * Main area: Cues (left) | Divider | Notes (right)
   */
  private buildMainArea(parent: HTMLElement): void {
    const main = parent.createDiv({ cls: "cornell-main-area" });

    // ── Left: Cues / Questions / Ideas ──
    const cuesPanel = main.createDiv({
      cls: "cornell-panel cornell-cues-panel",
    });
    this.buildPanelHeader(cuesPanel, "?", "Вопросы / Идеи");

    this.cuesEditor = cuesPanel.createEl("textarea", {
      cls: "cornell-editor cornell-cues-editor",
      attr: {
        placeholder:
          "• Ключевые вопросы\n• Идеи и ассоциации\n• Термины\n• Связи с другими темами",
        spellcheck: "true",
      },
    });
    this.cuesEditor.addEventListener("input", () => {
      this.data.cues = this.cuesEditor!.value;
      this.onContentChanged();
    });

    // ── Draggable divider ──
    const divider = main.createDiv({ cls: "cornell-divider" });
    this.setupDividerDrag(divider, main, cuesPanel);

    // ── Right: Notes ──
    const notesPanel = main.createDiv({
      cls: "cornell-panel cornell-notes-panel",
    });
    this.buildPanelHeader(notesPanel, "✎", "Конспект");

    this.notesEditor = notesPanel.createEl("textarea", {
      cls: "cornell-editor cornell-notes-editor",
      attr: {
        placeholder:
          "Основные записи лекции / материала...\n\nИспользуйте отступы и структуру для организации.",
        spellcheck: "true",
      },
    });
    this.notesEditor.addEventListener("input", () => {
      this.data.notes = this.notesEditor!.value;
      this.onContentChanged();
    });
  }

  /**
   * Summary strip at the bottom
   */
  private buildSummaryPanel(parent: HTMLElement): void {
    const panel = parent.createDiv({ cls: "cornell-summary-panel" });
    this.buildPanelHeader(panel, "Σ", "Резюме");

    this.summaryEditor = panel.createEl("textarea", {
      cls: "cornell-editor cornell-summary-editor",
      attr: {
        placeholder: "Краткое резюме — основные выводы и суть конспекта...",
        spellcheck: "true",
      },
    });
    this.summaryEditor.addEventListener("input", () => {
      this.data.summary = this.summaryEditor!.value;
      this.onContentChanged();
    });
  }

  /**
   * Panel header with icon and label
   */
  private buildPanelHeader(
    parent: HTMLElement,
    icon: string,
    label: string
  ): void {
    const header = parent.createDiv({ cls: "cornell-panel-header" });
    header.createSpan({ cls: "cornell-panel-icon", text: icon });
    header.createSpan({ text: label });
  }

  /**
   * Status bar: word count, dates
   */
  private buildStatusBar(parent: HTMLElement): void {
    this.statusBarEl = parent.createDiv({ cls: "cornell-status-bar" });
    this.refreshStatusBar();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Save & Sync
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Called on every keystroke in any editor field.
   * Immediately marks the file as dirty — Obsidian will persist it
   * on its own schedule (identical to how .md files auto-save).
   */
  private onContentChanged(): void {
    if (this.isLoading) return;

    this.data.modified = new Date().toISOString();
    this.requestSave(); // Obsidian's native save — same as markdown notes
    this.refreshStatusBar();
  }

  /**
   * Push data model → DOM (used when file is loaded or changed externally)
   */
  private syncDataToEditors(): void {
    if (this.titleEditor) this.titleEditor.value = this.data.title;
    if (this.tagsEditor) this.tagsEditor.value = this.data.tags.join(", ");
    if (this.cuesEditor) this.cuesEditor.value = this.data.cues;
    if (this.notesEditor) this.notesEditor.value = this.data.notes;
    if (this.summaryEditor) this.summaryEditor.value = this.data.summary;
  }

  /**
   * Refresh the status bar with current metadata
   */
  private refreshStatusBar(): void {
    if (!this.statusBarEl) return;
    this.statusBarEl.empty();

    const totalWords = countWords(
      [this.data.notes, this.data.cues, this.data.summary].join(" ")
    );

    this.statusBarEl.createSpan({
      text: `Слов: ${totalWords}`,
      cls: "cornell-status-item",
    });
    this.statusBarEl.createSpan({
      text: `Создано: ${formatDate(this.data.created)}`,
      cls: "cornell-status-item",
    });
    this.statusBarEl.createSpan({
      text: `Изменено: ${formatDate(this.data.modified)}`,
      cls: "cornell-status-item",
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Interactions
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Draggable divider between Cues and Notes panels
   */
  private setupDividerDrag(
    divider: HTMLElement,
    mainArea: HTMLElement,
    cuesPanel: HTMLElement
  ): void {
    let startX = 0;
    let startWidth = 0;

    const onMouseDown = (e: MouseEvent) => {
      startX = e.clientX;
      startWidth = cuesPanel.offsetWidth;
      divider.addClass("cornell-divider-active");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const maxW = mainArea.offsetWidth - 200;
      const newWidth = Math.max(150, Math.min(startWidth + delta, maxW));
      cuesPanel.style.width = `${newWidth}px`;
      cuesPanel.style.flex = "none";
    };

    const onMouseUp = () => {
      divider.removeClass("cornell-divider-active");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    divider.addEventListener("mousedown", onMouseDown);
  }

  /**
   * Tab / Shift+Tab cycles focus between three editor panels
   */
  private setupTabNavigation(): void {
    const editors = [this.cuesEditor, this.notesEditor, this.summaryEditor];

    editors.forEach((editor, idx) => {
      if (!editor) return;

      editor.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key !== "Tab" || e.ctrlKey || e.altKey) return;
        e.preventDefault();

        const step = e.shiftKey ? -1 : 1;
        const next = (idx + step + editors.length) % editors.length;
        editors[next]?.focus();
      });
    });
  }
}
