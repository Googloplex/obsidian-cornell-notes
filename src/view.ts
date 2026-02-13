// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — View (Three-panel editor with .md file backing)
// ═══════════════════════════════════════════════════════════════════════════

import { TextFileView, WorkspaceLeaf, TFile, debounce } from "obsidian";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
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
import {
  createEmbeddableEditor,
  EmbeddableMarkdownEditor,
} from "./embedded-editor";
import type { CornellSettings } from "./settings";

// ─── Section panel state ─────────────────────────────────────────────────

interface SectionPanel {
  key: SectionKey;
  container: HTMLElement;
  editorContainer: HTMLElement;
  editor: EmbeddableMarkdownEditor | null;
  content: string;      // raw markdown (without frontmatter)
  fullContent: string;  // full file content (with frontmatter)
  file: TFile | null;
  saving: boolean;      // guard against save-reload loop
}

// ─── Placeholder texts ──────────────────────────────────────────────────

const PLACEHOLDERS: Record<SectionKey, string> = {
  cues: "Ключевые вопросы, идеи, термины...",
  notes: "Основные записи лекции / материала...",
  summary: "Краткое резюме — основные выводы...",
};

export class CornellNotesView extends TextFileView {
  private manifest: CornellManifest = createManifest("");
  private panels: Map<SectionKey, SectionPanel> = new Map();
  private titleEditor: HTMLInputElement | null = null;
  private tagsEditor: HTMLInputElement | null = null;
  private statusBarEl: HTMLElement | null = null;
  private isLoading = false;
  private getSettings: () => CornellSettings;

  constructor(leaf: WorkspaceLeaf, getSettings: () => CornellSettings) {
    super(leaf);
    this.getSettings = getSettings;
  }

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
      if (panel.editor) {
        panel.editor.updateContent("");
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cornell-notes-container");

    const settings = this.getSettings();
    const summaryTop = settings.summaryPosition === "top";

    this.buildTitleBar(contentEl);

    if (summaryTop) {
      this.buildSummaryPanel(contentEl);
      this.buildSummaryDivider(contentEl, summaryTop);
      this.buildMainArea(contentEl);
    } else {
      this.buildMainArea(contentEl);
      this.buildSummaryDivider(contentEl, summaryTop);
      this.buildSummaryPanel(contentEl);
    }

    this.buildStatusBar(contentEl);

    // Watch for external file changes
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!(file instanceof TFile)) return;
        for (const panel of this.panels.values()) {
          if (panel.file && panel.file.path === file.path && !panel.saving) {
            this.loadPanelContent(panel);
          }
        }
      })
    );
  }

  async onClose(): Promise<void> {
    // panel.content is kept up-to-date by onChange callback on every keystroke.
    // Do NOT read from panel.editor.value here — editors may already be
    // destroyed by Component lifecycle, returning empty string and wiping data.
    for (const panel of this.panels.values()) {
      if (panel.file && panel.content) {
        await this.savePanelContent(panel);
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
    const cuesRight = this.getSettings().cuesPosition === "right";
    const main = parent.createDiv({ cls: "cornell-main-area" });

    const firstKey: SectionKey = cuesRight ? "notes" : "cues";
    const secondKey: SectionKey = cuesRight ? "cues" : "notes";
    const firstCls = cuesRight ? "cornell-panel cornell-notes-panel" : "cornell-panel cornell-cues-panel";
    const secondCls = cuesRight ? "cornell-panel cornell-cues-panel" : "cornell-panel cornell-notes-panel";

    this.buildSectionPanel(main, firstKey, firstCls);
    const divider = main.createDiv({ cls: "cornell-divider" });
    this.buildSectionPanel(main, secondKey, secondCls);

    const cuesPanel = main.querySelector(".cornell-cues-panel") as HTMLElement;
    this.setupDividerDrag(divider, main, cuesPanel, cuesRight);
  }

  private buildSummaryDivider(parent: HTMLElement, summaryTop: boolean): void {
    const divider = parent.createDiv({ cls: "cornell-divider-horizontal" });
    this.setupSummaryDividerDrag(divider, parent, summaryTop);
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

    // Content area — holds the embedded CM6 editor
    const editorContainer = container.createDiv({ cls: "cornell-panel-content" });

    const panel: SectionPanel = {
      key,
      container,
      editorContainer,
      editor: null,
      content: "",
      fullContent: "",
      file: null,
      saving: false,
    };

    this.panels.set(key, panel);
  }

  private buildStatusBar(parent: HTMLElement): void {
    this.statusBarEl = parent.createDiv({ cls: "cornell-status-bar" });
    this.refreshStatusBar();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Embedded editor initialization
  // ═══════════════════════════════════════════════════════════════════════

  private initPanelEditor(panel: SectionPanel): void {
    // Destroy existing editor if any
    if (panel.editor) {
      this.removeChild(panel.editor as any);
      panel.editor = null;
    }

    const debouncedSave = debounce(() => {
      this.savePanelContent(panel);
    }, 1000, true);

    // Tab = navigate panels, Shift+Tab = insert tab character
    const tabExtension = Prec.highest(
      keymap.of([
        {
          key: "Tab",
          run: () => {
            this.focusNextPanel(panel.key, false);
            return true;
          },
        },
        {
          key: "Shift-Tab",
          run: (view) => {
            view.dispatch(view.state.replaceSelection("\t"));
            return true;
          },
        },
      ]),
    );

    const editor = createEmbeddableEditor(this.app, panel.editorContainer, {
      value: panel.content,
      placeholder: PLACEHOLDERS[panel.key],
      cls: "cornell-embedded-editor",
      extraExtensions: [tabExtension],
      onChange: (_update, _editor) => {
        panel.content = _editor.value;
        debouncedSave();
        this.refreshStatusBar();
      },
      onEscape: (_editor) => {
        _editor.editor.cm.contentDOM.blur();
      },
      onEnter: () => false, // normal Enter = newline
      onBlur: () => {
        // Flush debounced save immediately
        debouncedSave.cancel?.();
        this.savePanelContent(panel);
      },
    });

    panel.editor = editor;
    this.addChild(editor as any);
  }

  private focusNextPanel(currentKey: SectionKey, reverse: boolean): void {
    const keys = SECTION_KEYS;
    const idx = keys.indexOf(currentKey);
    const step = reverse ? -1 : 1;
    const nextKey = keys[(idx + step + keys.length) % keys.length];
    const nextPanel = this.panels.get(nextKey);
    if (nextPanel?.editor) {
      nextPanel.editor.editor.cm.contentDOM.focus();
    }
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
        if (panel.editor) {
          panel.editor.updateContent("");
        } else {
          this.initPanelEditor(panel);
        }
      }
    }
  }

  private async loadPanelContent(panel: SectionPanel): Promise<void> {
    if (!panel.file) return;
    const raw = await this.app.vault.read(panel.file);
    panel.fullContent = raw;
    panel.content = stripFrontmatter(raw);

    if (panel.editor) {
      // Update existing editor (external file changes)
      // Only update if content differs to avoid cursor jumps
      if (panel.editor.value !== panel.content) {
        panel.editor.updateContent(panel.content);
      }
    } else {
      // First load: create the editor
      this.initPanelEditor(panel);
    }

    this.refreshStatusBar();
  }

  private async savePanelContent(panel: SectionPanel): Promise<void> {
    if (!panel.file || panel.saving) return;
    panel.saving = true;

    try {
      // Preserve frontmatter, replace body
      const fmMatch = panel.fullContent.match(/^(---\n[\s\S]*?\n---\n?)/);
      const frontmatter = fmMatch ? fmMatch[1] : "";
      const newFull = frontmatter + panel.content;

      panel.fullContent = newFull;
      await this.app.vault.modify(panel.file, newFull);

      // Update manifest modified time
      this.manifest.modified = new Date().toISOString();
      this.requestSave();
    } finally {
      panel.saving = false;
    }
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
    cuesPanel: HTMLElement,
    reverse: boolean
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
      const delta = reverse ? startX - e.clientX : e.clientX - startX;
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

  private setupSummaryDividerDrag(
    divider: HTMLElement,
    container: HTMLElement,
    summaryTop: boolean
  ): void {
    let startY = 0;
    let startHeight = 0;
    let summaryPanel: HTMLElement | null = null;

    const onMouseDown = (e: MouseEvent) => {
      summaryPanel = container.querySelector(".cornell-summary-panel") as HTMLElement;
      if (!summaryPanel) return;
      startY = e.clientY;
      startHeight = summaryPanel.offsetHeight;
      divider.addClass("cornell-divider-horizontal-active");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!summaryPanel) return;
      const delta = summaryTop ? e.clientY - startY : startY - e.clientY;
      const newHeight = Math.max(80, Math.min(startHeight + delta, container.offsetHeight - 200));
      summaryPanel.style.height = `${newHeight}px`;
      summaryPanel.style.flexShrink = "0";
    };

    const onMouseUp = () => {
      divider.removeClass("cornell-divider-horizontal-active");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      summaryPanel = null;
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
