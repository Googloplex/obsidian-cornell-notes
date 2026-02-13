// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — Settings
// ═══════════════════════════════════════════════════════════════════════════

import { App, PluginSettingTab, Setting } from "obsidian";
import type CornellNotesPlugin from "../main";

// ─── Settings Model ──────────────────────────────────────────────────────

export type CuesPosition = "left" | "right";
export type SummaryPosition = "bottom" | "top";

export interface CornellSettings {
  defaultFolder: string;
  cuesPosition: CuesPosition;
  summaryPosition: SummaryPosition;
}

export const DEFAULT_SETTINGS: CornellSettings = {
  defaultFolder: "Cornell Notes",
  cuesPosition: "left",
  summaryPosition: "bottom",
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
            await this.plugin.ensureRootFolder();
          })
      );

    new Setting(containerEl)
      .setName("Расположение вопросов (Cues)")
      .setDesc("Панель вопросов/идей слева или справа от конспекта")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("left", "Слева")
          .addOption("right", "Справа")
          .setValue(this.plugin.settings.cuesPosition)
          .onChange(async (value) => {
            this.plugin.settings.cuesPosition = value as CuesPosition;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Расположение резюме (Summary)")
      .setDesc("Панель резюме сверху или снизу")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("bottom", "Снизу")
          .addOption("top", "Сверху")
          .setValue(this.plugin.settings.summaryPosition)
          .onChange(async (value) => {
            this.plugin.settings.summaryPosition = value as SummaryPosition;
            await this.plugin.saveSettings();
          })
      );
  }
}
