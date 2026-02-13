// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — View (Three-panel editor with .md file backing)
// ═══════════════════════════════════════════════════════════════════════════

import { TextFileView, WorkspaceLeaf, TFile, MarkdownRenderer } from "obsidian";
import {
  CORNELL_VIEW_TYPE,
  CORNELL_ICON,
  SectionKey,
  SECTIONS,
  SECTION_KEYS,
  CornellManifest,
  createManifest,
  parseManifest,
  serializeManifest,
  sectionFilePath,
  stripFrontmatter,
  formatDate,
  countWords,
} from "./types";

// ─── Section panel state ─────────────────────────────────────────────────

interface SectionPanel {
  key: SectionKey;
  container: HTMLElement;
  renderEl: HTMLElement;
  editorEl: HTMLTextAreaElement;
  editing: boolean;
  content: string;      // raw markdown (without frontmatter)
  fullContent: string;  // full file content (with frontmatter)
  file: TFile | null;
}

export class CornellNotesView extends TextFileView {
  private manifest: CornellManifest = createManifest("");
  private panels: Map<SectionKey, SectionPanel> = new Map();
  private titleEditor: HTMLInputElement | null = null;
  private tagsEditor: HTMLInputElement | null = null;
  private statusBarEl: HTMLElement | null = null;
  private isLoading = false;

  // ═══════════════════════════════════════════════════════════════════════
  // TextFileView interface
  // ═══════════════════════════════════════════════════════════════════════

  getViewType(): string {
    return CORNELL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.manifest.title || this.file?.basename || "Cornell Notes";
  }

  getIcon(): string {
    return CORNELL_ICON;
  }

  getViewData(): string {
    return serializeManifest(this.manifest);
  }

  setViewData(data: string, clear: boolean): void {
    this.isLoading = true;
    this.manifest = parseManifest(data);
    this.syncManifestToUI();
    this.loadSectionFiles();
    this.isLoading = false;
  }

  clear(): void {
    this.manifest = createManifest("");
    this.syncManifestToUI();
    for (const panel of this.panels.values()) {
      panel.content = "";
      panel.fullContent = "";
      panel.file = null;
      this.renderPanel(panel);
    }
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

    // Watch for external file changes
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!(file instanceof TFile)) return;
        for (const panel of this.panels.values()) {
          if (panel.file && panel.file.path === file.path && !panel.editing) {
            this.loadPanelContent(panel);
          }
        }
      })
    );
  }

  async onClose(): Promise<void> {
    // Save any panel that's still in editing mode
    for (const panel of this.panels.values()) {
      if (panel.editing) {
        await this.commitPanelEdit(panel);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UI Construction
  // ═══════════════════════════════════════════════════════════════════════

  private buildTitleBar(parent: HTMLElement): void {
    const bar = parent.createDiv({ cls: "cornell-title-bar" });

    this.titleEditor = bar.createEl("input", {
      cls: "cornell-title-input",
      attr: { type: "text", placeholder: "Заголовок конспекта..." },
    });
    this.titleEditor.addEventListener("input", () => {
      this.manifest.title = this.titleEditor!.value;
      this.onManifestChanged();
    });

    this.tagsEditor = bar.createEl("input", {
      cls: "cornell-tags-input",
      attr: { type: "text", placeholder: "Теги: #тег1, #тег2..." },
    });
    this.tagsEditor.addEventListener("input", () => {
      this.manifest.tags = this.tagsEditor!.value
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      this.onManifestChanged();
    });
  }

  private buildMainArea(parent: HTMLElement): void {
    const main = parent.createDiv({ cls: "cornell-main-area" });

    this.buildSectionPanel(main, "cues", "cornell-panel cornell-cues-panel");

    const divider = main.createDiv({ cls: "cornell-divider" });
    const cuesPanel = main.querySelector(".cornell-cues-panel") as HTMLElement;
    this.setupDividerDrag(divider, main, cuesPanel);

    this.buildSectionPanel(main, "notes", "cornell-panel cornell-notes-panel");
  }

  private buildSummaryPanel(parent: HTMLElement): void {
    this.buildSectionPanel(parent, "summary", "cornell-summary-panel");
  }

  private buildSectionPanel(parent: HTMLElement, key: SectionKey, cls: string): void {
    const section = SECTIONS[key];
    const container = parent.createDiv({ cls });

    // Header
    const header = container.createDiv({ cls: "cornell-panel-header" });
    const iconCls = key === "cues" ? "?" : key === "notes" ? "✎" : "Σ";
    header.createSpan({ cls: "cornell-panel-icon", text: iconCls });
    header.createSpan({ text: section.label });

    // Content area — holds both render and editor
    const contentArea = container.createDiv({ cls: "cornell-panel-content" });

    // Rendered markdown (visible by default)
    const renderEl = contentArea.createDiv({ cls: "cornell-render" });

    // Textarea editor (hidden by default)
    const editorEl = contentArea.createEl("textarea", {
      cls: "cornell-editor cornell-editor-hidden",
      attr: { spellcheck: "true" },
    });

    const panel: SectionPanel = {
      key,
      container,
      renderEl,
      editorEl,
      editing: false,
      content: "",
      fullContent: "",
      file: null,
    };

    // Click rendered area → enter editing
    renderEl.addEventListener("click", () => this.enterEditMode(panel));

    // Blur editor → save and render
    editorEl.addEventListener("blur", () => this.commitPanelEdit(panel));

    // Tab navigation between panels
    editorEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const keys = SECTION_KEYS;
        const idx = keys.indexOf(key);
        const step = e.shiftKey ? -1 : 1;
        const nextKey = keys[(idx + step + keys.length) % keys.length];
        const nextPanel = this.panels.get(nextKey);
        if (nextPanel) this.enterEditMode(nextPanel);
      }
    });

    this.panels.set(key, panel);
  }

  private buildStatusBar(parent: HTMLElement): void {
    this.statusBarEl = parent.createDiv({ cls: "cornell-status-bar" });
    this.refreshStatusBar();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Section file I/O
  // ═══════════════════════════════════════════════════════════════════════

  private loadSectionFiles(): void {
    if (!this.file) return;
    const folderPath = this.file.parent?.path;
    const baseName = this.manifest.title || this.file.basename;
    if (!folderPath) return;

    for (const key of SECTION_KEYS) {
      const panel = this.panels.get(key);
      if (!panel) continue;

      const path = sectionFilePath(folderPath, baseName, key);
      const file = this.app.vault.getAbstractFileByPath(path);

      if (file instanceof TFile) {
        panel.file = file;
        this.loadPanelContent(panel);
      } else {
        panel.file = null;
        panel.content = "";
        panel.fullContent = "";
        this.renderPanel(panel);
      }
    }
  }

  private async loadPanelContent(panel: SectionPanel): Promise<void> {
    if (!panel.file) return;
    const raw = await this.app.vault.read(panel.file);
    panel.fullContent = raw;
    panel.content = stripFrontmatter(raw);
    this.renderPanel(panel);
    this.refreshStatusBar();
  }

  private async savePanelContent(panel: SectionPanel): Promise<void> {
    if (!panel.file) return;

    // Preserve frontmatter, replace body
    const fmMatch = panel.fullContent.match(/^(---\n[\s\S]*?\n---\n?)/);
    const frontmatter = fmMatch ? fmMatch[1] : "";
    const newFull = frontmatter + panel.content;

    panel.fullContent = newFull;
    await this.app.vault.modify(panel.file, newFull);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Edit mode
  // ═══════════════════════════════════════════════════════════════════════

  private enterEditMode(panel: SectionPanel): void {
    if (panel.editing) return;
    panel.editing = true;

    panel.renderEl.addClass("cornell-render-hidden");
    panel.editorEl.removeClass("cornell-editor-hidden");
    panel.editorEl.value = panel.content;
    panel.editorEl.focus();
  }

  private async commitPanelEdit(panel: SectionPanel): Promise<void> {
    if (!panel.editing) return;
    panel.editing = false;

    panel.content = panel.editorEl.value;
    panel.editorEl.addClass("cornell-editor-hidden");
    panel.renderEl.removeClass("cornell-render-hidden");

    await this.savePanelContent(panel);
    this.renderPanel(panel);
    this.refreshStatusBar();

    // Update manifest modified time
    this.manifest.modified = new Date().toISOString();
    this.requestSave();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Rendering
  // ═══════════════════════════════════════════════════════════════════════

  private renderPanel(panel: SectionPanel): void {
    panel.renderEl.empty();

    if (!panel.content.trim()) {
      const placeholders: Record<SectionKey, string> = {
        cues: "Ключевые вопросы, идеи, термины...\nНажмите, чтобы редактировать",
        notes: "Основные записи лекции / материала...\nНажмите, чтобы редактировать",
        summary: "Краткое резюме — основные выводы...\nНажмите, чтобы редактировать",
      };
      panel.renderEl.createDiv({
        cls: "cornell-placeholder",
        text: placeholders[panel.key],
      });
      return;
    }

    const sourcePath = panel.file?.path ?? this.file?.path ?? "";
    MarkdownRenderer.render(
      this.app,
      panel.content,
      panel.renderEl,
      sourcePath,
      this,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Manifest sync
  // ═══════════════════════════════════════════════════════════════════════

  private syncManifestToUI(): void {
    if (this.titleEditor) this.titleEditor.value = this.manifest.title;
    if (this.tagsEditor) this.tagsEditor.value = this.manifest.tags.join(", ");
    this.refreshStatusBar();
  }

  private onManifestChanged(): void {
    if (this.isLoading) return;
    this.manifest.modified = new Date().toISOString();
    this.requestSave();
    this.refreshStatusBar();
  }

  private refreshStatusBar(): void {
    if (!this.statusBarEl) return;
    this.statusBarEl.empty();

    let totalText = "";
    for (const panel of this.panels.values()) {
      totalText += panel.content + " ";
    }

    this.statusBarEl.createSpan({
      text: `Слов: ${countWords(totalText)}`,
      cls: "cornell-status-item",
    });
    this.statusBarEl.createSpan({
      text: `Создано: ${formatDate(this.manifest.created)}`,
      cls: "cornell-status-item",
    });
    this.statusBarEl.createSpan({
      text: `Изменено: ${formatDate(this.manifest.modified)}`,
      cls: "cornell-status-item",
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Interactions
  // ═══════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════
  // Public API (for export modal)
  // ═══════════════════════════════════════════════════════════════════════

  getManifest(): CornellManifest {
    return this.manifest;
  }

  getSectionContent(key: SectionKey): string {
    return this.panels.get(key)?.content ?? "";
  }
}
