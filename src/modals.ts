// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — Modals
// ═══════════════════════════════════════════════════════════════════════════

import { Modal, Notice, Setting, App } from "obsidian";
import { CornellData } from "./types";

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

    // File name
    new Setting(contentEl).setName("Название").addText((text) => {
      text
        .setPlaceholder("Название конспекта...")
        .onChange((value) => (this.fileName = value));

      // Auto-focus
      setTimeout(() => text.inputEl.focus(), 50);
    });

    // Target folder
    new Setting(contentEl).setName("Папка").addText((text) =>
      text
        .setPlaceholder("/")
        .setValue(this.folderPath)
        .onChange((value) => (this.folderPath = value))
    );

    // Submit button
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Создать")
        .setCta()
        .onClick(() => this.submit())
    );

    // Enter to submit
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

// ─── Export to Markdown ──────────────────────────────────────────────────

export class ExportCornellNoteModal extends Modal {
  private data: CornellData;

  constructor(app: App, data: CornellData) {
    super(app);
    this.data = data;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl("h3", { text: "Экспорт в Markdown" });

    // Preview
    const md = this.toMarkdown();
    const preview = contentEl.createEl("textarea", {
      cls: "cornell-export-preview",
      attr: { readonly: "true", rows: "20" },
    });
    preview.value = md;
    preview.style.width = "100%";
    preview.style.fontFamily = "monospace";
    preview.style.fontSize = "12px";

    // Actions
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
            const fileName = this.data.title || "Cornell Export";
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

  private toMarkdown(): string {
    const tags =
      this.data.tags.length > 0 ? `\ntags: ${this.data.tags.join(", ")}` : "";

    return [
      `# ${this.data.title}${tags}`,
      `---`,
      ``,
      `## Вопросы / Идеи`,
      ``,
      this.data.cues,
      ``,
      `## Конспект`,
      ``,
      this.data.notes,
      ``,
      `## Резюме`,
      ``,
      this.data.summary,
      ``,
      `---`,
      `*Cornell Notes — создано ${new Date(this.data.created).toLocaleDateString("ru-RU")}*`,
    ].join("\n");
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
