// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — Modals
// ═══════════════════════════════════════════════════════════════════════════

import { Modal, Notice, Setting, App } from "obsidian";
import { SECTIONS, SECTION_KEYS } from "./types";
import type { CornellNotesView } from "./view";

// ─── Create Cornell Note ─────────────────────────────────────────────────

export class CreateCornellNoteModal extends Modal {
  private fileName: string = "";
  private folderPath: string;
  private onSubmit: (name: string, folder: string) => void;

  constructor(
    app: App,
    defaultFolder: string,
    onSubmit: (name: string, folder: string) => void
  ) {
    super(app);
    this.folderPath = defaultFolder;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl("h3", { text: "Новый конспект (Cornell Notes)" });

    new Setting(contentEl).setName("Название").addText((text) => {
      text
        .setPlaceholder("Название конспекта...")
        .onChange((value) => (this.fileName = value));
      setTimeout(() => text.inputEl.focus(), 50);
    });

    new Setting(contentEl).setName("Папка").addText((text) =>
      text
        .setPlaceholder("/")
        .setValue(this.folderPath)
        .onChange((value) => (this.folderPath = value))
    );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Создать")
        .setCta()
        .onClick(() => this.submit())
    );

    contentEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") this.submit();
    });
  }

  private submit(): void {
    const name = this.fileName.trim();
    if (!name) {
      new Notice("Введите название конспекта");
      return;
    }
    this.onSubmit(name, this.folderPath.trim());
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ─── Aggregate / Export ──────────────────────────────────────────────────

export class AggregateCornellModal extends Modal {
  private view: CornellNotesView;

  constructor(app: App, view: CornellNotesView) {
    super(app);
    this.view = view;
  }

  onOpen(): void {
    const { contentEl } = this;
    const manifest = this.view.getManifest();

    contentEl.createEl("h3", { text: "Экспорт в Markdown" });

    const md = this.aggregate();
    const preview = contentEl.createEl("textarea", {
      cls: "cornell-export-preview",
      attr: { readonly: "true", rows: "20" },
    });
    preview.value = md;
    preview.style.width = "100%";
    preview.style.fontFamily = "monospace";
    preview.style.fontSize = "12px";

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Копировать").onClick(() => {
          navigator.clipboard.writeText(md);
          new Notice("Скопировано в буфер обмена");
        })
      )
      .addButton((btn) =>
        btn
          .setButtonText("Создать заметку .md")
          .setCta()
          .onClick(async () => {
            const fileName = manifest.title || "Cornell Export";
            const path = `${fileName}.md`;
            try {
              await this.app.vault.create(path, md);
              new Notice(`Создана заметка: ${path}`);
              this.close();
            } catch (e) {
              new Notice(`Ошибка: ${e}`);
            }
          })
      );
  }

  private aggregate(): string {
    const manifest = this.view.getManifest();
    const tags =
      manifest.tags.length > 0 ? `\ntags: ${manifest.tags.join(", ")}` : "";

    const parts: string[] = [`# ${manifest.title}${tags}`, `---`, ``];

    for (const key of SECTION_KEYS) {
      const section = SECTIONS[key];
      const content = this.view.getSectionContent(key);
      parts.push(`## ${section.label}`, ``, content, ``);
    }

    parts.push(
      `---`,
      `*Cornell Notes — создано ${new Date(manifest.created).toLocaleDateString("ru-RU")}*`
    );

    return parts.join("\n");
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
