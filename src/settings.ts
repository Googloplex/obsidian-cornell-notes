// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — Settings
// ═══════════════════════════════════════════════════════════════════════════

import { App, PluginSettingTab, Setting } from "obsidian";
import type CornellNotesPlugin from "../main";

// ─── Settings Model ──────────────────────────────────────────────────────

export type SectionName = "cues" | "notes" | "summary";

export interface CornellSettings {
  defaultFolder: string;
  createMdCompanion: boolean;
  mdSectionOrder: SectionName[];
}

export const DEFAULT_SETTINGS: CornellSettings = {
  defaultFolder: "",
  createMdCompanion: false,
  mdSectionOrder: ["cues", "notes", "summary"],
};

// ─── Section labels (ru) ─────────────────────────────────────────────────

const SECTION_LABELS: Record<SectionName, string> = {
  cues: "Вопросы / Идеи",
  notes: "Конспект",
  summary: "Резюме",
};

// ─── Settings Tab ────────────────────────────────────────────────────────

export class CornellSettingsTab extends PluginSettingTab {
  private plugin: CornellNotesPlugin;

  constructor(app: App, plugin: CornellNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Cornell Notes — Настройки" });

    new Setting(containerEl)
      .setName("Папка по умолчанию")
      .setDesc("Папка для новых конспектов (оставьте пустым для корня хранилища)")
      .addText((text) =>
        text
          .setPlaceholder("/")
          .setValue(this.plugin.settings.defaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.defaultFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Создавать .md-копию")
      .setDesc("Автоматически создавать Markdown-файл рядом с .cornell")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.createMdCompanion)
          .onChange(async (value) => {
            this.plugin.settings.createMdCompanion = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

// ─── Markdown generation ─────────────────────────────────────────────────

export function generateMdContent(
  title: string,
  sectionOrder: SectionName[]
): string {
  const sections = sectionOrder.map(
    (s) => `## ${SECTION_LABELS[s]}\n\n`
  );

  return [`# ${title}`, ``, ...sections, `---`, `*Cornell Notes*`, ``].join(
    "\n"
  );
}
