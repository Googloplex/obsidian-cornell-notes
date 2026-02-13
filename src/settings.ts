// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — Settings
// ═══════════════════════════════════════════════════════════════════════════

import { App, PluginSettingTab, Setting } from "obsidian";
import type CornellNotesPlugin from "../main";

// ─── Settings Model ──────────────────────────────────────────────────────

export interface CornellSettings {
  defaultFolder: string;
}

export const DEFAULT_SETTINGS: CornellSettings = {
  defaultFolder: "",
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
  }
}
