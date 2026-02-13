// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes Plugin — Entry Point
// ═══════════════════════════════════════════════════════════════════════════

import {
  Plugin,
  WorkspaceLeaf,
  TFile,
  TFolder,
  Menu,
  Notice,
} from "obsidian";

import {
  CORNELL_VIEW_TYPE,
  CORNELL_EXTENSION,
  CORNELL_ICON,
  SECTION_KEYS,
  createManifest,
  serializeManifest,
  sectionFilePath,
  generateFrontmatter,
} from "./src/types";
import { CornellNotesView } from "./src/view";
import { CreateCornellNoteModal, AggregateCornellModal } from "./src/modals";
import {
  CornellSettings,
  DEFAULT_SETTINGS,
  CornellSettingsTab,
} from "./src/settings";

export default class CornellNotesPlugin extends Plugin {
  settings: CornellSettings = DEFAULT_SETTINGS;

  // ═══════════════════════════════════════════════════════════════════════
  // Plugin lifecycle
  // ═══════════════════════════════════════════════════════════════════════

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new CornellSettingsTab(this.app, this));

    this.registerCornellView();
    this.registerCommands();
    this.registerRibbonIcon();
    this.registerContextMenu();

    console.log("Cornell Notes plugin loaded");
  }

  onunload(): void {
    console.log("Cornell Notes plugin unloaded");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Registration
  // ═══════════════════════════════════════════════════════════════════════

  private registerCornellView(): void {
    this.registerView(
      CORNELL_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new CornellNotesView(leaf)
    );
    this.registerExtensions([CORNELL_EXTENSION], CORNELL_VIEW_TYPE);
  }

  private registerCommands(): void {
    this.addCommand({
      id: "create-cornell-note",
      name: "Создать новый конспект (Cornell Notes)",
      callback: () => this.openCreateModal(),
    });

    this.addCommand({
      id: "export-cornell-note",
      name: "Экспортировать конспект в Markdown",
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(CornellNotesView);
        if (!view) {
          new Notice("Откройте конспект Cornell Notes для экспорта");
          return;
        }
        new AggregateCornellModal(this.app, view).open();
      },
    });
  }

  private registerRibbonIcon(): void {
    this.addRibbonIcon(
      CORNELL_ICON,
      "Новый конспект (Cornell Notes)",
      () => this.openCreateModal()
    );
  }

  private registerContextMenu(): void {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
        if (!(file instanceof TFolder)) return;

        menu.addItem((item) => {
          item
            .setTitle("Новый конспект (Cornell Notes)")
            .setIcon(CORNELL_ICON)
            .onClick(() => {
              new CreateCornellNoteModal(
                this.app,
                file.path,
                (name, folder) => this.createCornellNote(name, folder)
              ).open();
            });
        });
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════════════════

  private openCreateModal(): void {
    const activeFile = this.app.workspace.getActiveFile();
    const defaultFolder =
      activeFile?.parent?.path ?? this.settings.defaultFolder ?? "";

    new CreateCornellNoteModal(
      this.app,
      defaultFolder,
      (name, folder) => this.createCornellNote(name, folder)
    ).open();
  }

  private async createCornellNote(name: string, folder: string): Promise<void> {
    const noteFolder = folder && folder !== "/" ? `${folder}/${name}` : name;

    if (this.app.vault.getAbstractFileByPath(noteFolder)) {
      new Notice(`Папка "${noteFolder}" уже существует`);
      return;
    }

    await this.app.vault.createFolder(noteFolder);

    // Create section .md files
    for (const key of SECTION_KEYS) {
      const path = sectionFilePath(noteFolder, name, key);
      const content = generateFrontmatter(key, name);
      await this.app.vault.create(path, content);
    }

    // Create .cornell manifest
    const manifestPath = `${noteFolder}/${name}.${CORNELL_EXTENSION}`;
    const manifest = createManifest(name);
    await this.app.vault.create(manifestPath, serializeManifest(manifest));

    // Open the cornell view
    const file = this.app.vault.getAbstractFileByPath(manifestPath);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
    }

    new Notice(`Конспект "${name}" создан`);
  }
}
