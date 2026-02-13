// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — Embeddable Markdown Editor (CM6 Live Preview)
// Adapted from Fevol's gist (MIT), original by mgmeyers (obsidian-kanban)
// https://gist.github.com/Fevol/caa478ce303e69eabede7b12b2323838
// ═══════════════════════════════════════════════════════════════════════════

import { App, Component, Scope, TFile, WorkspaceLeaf } from "obsidian";
import { Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder, ViewUpdate } from "@codemirror/view";
import { around } from "monkey-around";

// ─── Options ─────────────────────────────────────────────────────────────

export interface EmbeddedEditorOptions {
  value?: string;
  placeholder?: string;
  cls?: string;
  extraExtensions?: Extension[];
  onEnter?: (editor: EmbeddableMarkdownEditor, mod: boolean, shift: boolean) => boolean;
  onEscape?: (editor: EmbeddableMarkdownEditor) => void;
  onBlur?: (editor: EmbeddableMarkdownEditor) => void;
  onChange?: (update: ViewUpdate, editor: EmbeddableMarkdownEditor) => void;
  onPaste?: (e: ClipboardEvent, editor: EmbeddableMarkdownEditor) => void;
}

// ─── Public interface for the embedded editor ────────────────────────────

export interface EmbeddableMarkdownEditor extends Component {
  options: EmbeddedEditorOptions;
  scope: Scope;
  editor: any;       // Obsidian Editor wrapper
  editorEl: HTMLElement;
  containerEl: HTMLElement;
  readonly value: string;
  updateContent(newValue: string): void;
  destroy(): void;
}

// ─── Resolve ScrollableMarkdownEditor prototype (cached) ─────────────────

function resolveEditorPrototype(app: App): any {
  const embedRegistry = (app as any).embedRegistry;
  const mdCreator = embedRegistry.embedByExtension.md;

  const widgetEditorView = mdCreator(
    { app, containerEl: document.createElement("div") },
    null as unknown as TFile,
    "",
  );

  widgetEditorView.editable = true;
  widgetEditorView.showEditor();

  // Walk up prototype chain: editMode -> IFramedMarkdownEditor -> MarkdownScrollableEditView
  const proto = Object.getPrototypeOf(Object.getPrototypeOf(widgetEditorView.editMode!));
  const BaseConstructor = proto.constructor;

  widgetEditorView.unload();
  return BaseConstructor;
}

// ─── Lazy class factory (cached) ─────────────────────────────────────────

let CachedEditorClass: (new (
  app: App,
  container: HTMLElement,
  options: EmbeddedEditorOptions,
) => EmbeddableMarkdownEditor) | null = null;

// Staging variable: super() calls buildLocalExtensions() before
// this.options is assigned. We stash options here so the override
// can read them during construction.
let _pendingOptions: EmbeddedEditorOptions | null = null;

function getEditorClass(app: App) {
  if (CachedEditorClass) return CachedEditorClass;

  const Base = resolveEditorPrototype(app);

  CachedEditorClass = class EmbeddableMarkdownEditorImpl extends Base {
    options: EmbeddedEditorOptions;
    scope: Scope;

    constructor(app: App, container: HTMLElement, options: EmbeddedEditorOptions) {
      _pendingOptions = options;
      super(app, container, {
        app,
        onMarkdownScroll: () => {},
        getMode: () => "source",
      });

      this.options = options;
      _pendingOptions = null;
      this.scope = new Scope((app as any).scope);

      // Prevent Mod+Enter from triggering "Open link in new leaf" command
      this.scope.register(["Mod"], "Enter", () => true);

      // Mock MarkdownView references so editor commands work
      (this as any).owner.editMode = this;
      (this as any).owner.editor = this.editor;

      // Set initial content (required since Obsidian 1.5.8)
      this.set(options.value ?? "");

      // Patch workspace.setActiveLeaf to prevent focus stealing
      this.register(
        around(app.workspace, {
          setActiveLeaf: (oldMethod: Function) =>
            (leaf: WorkspaceLeaf, ...args: unknown[]) => {
              if (!(this as any).activeCM?.hasFocus)
                oldMethod.call(app.workspace, leaf, ...args);
            },
        }),
      );

      // Blur → save
      if (options.onBlur) {
        this.editor.cm.contentDOM.addEventListener("blur", () => {
          app.keymap.popScope(this.scope);
          if ((this as any)._loaded) options.onBlur!(this as any);
        });
      }

      // Focus → set active editor
      this.editor.cm.contentDOM.addEventListener("focusin", () => {
        app.keymap.pushScope(this.scope);
        (app.workspace as any).activeEditor = (this as any).owner;
      });

      // Optional CSS class
      if (options.cls) this.editorEl.classList.add(options.cls);
    }

    get value(): string {
      return this.editor.cm.state.doc.toString();
    }

    /** Replace editor content programmatically (external file changes) */
    updateContent(newValue: string): void {
      const cm: EditorView = this.editor.cm;
      cm.dispatch({
        changes: { from: 0, to: cm.state.doc.length, insert: newValue },
      });
    }

    buildLocalExtensions(): Extension[] {
      // this.options may be undefined when called from super() during
      // construction — fall back to the module-level staging variable.
      const opts = this.options ?? _pendingOptions;
      if (!opts) return super.buildLocalExtensions();

      const extensions: Extension[] = super.buildLocalExtensions();

      // CM6 update listener for onChange callback
      if (opts.onChange) {
        extensions.push(
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.docChanged) {
              opts.onChange!(update, this as any);
            }
          }),
        );
      }

      // Placeholder text
      if (opts.placeholder) {
        extensions.push(cmPlaceholder(opts.placeholder));
      }

      // Paste handler
      if (opts.onPaste) {
        extensions.push(
          EditorView.domEventHandlers({
            paste: (event: ClipboardEvent) => opts.onPaste!(event, this as any),
          }),
        );
      }

      // Key bindings: Enter, Mod+Enter, Escape
      extensions.push(
        Prec.highest(
          keymap.of([
            {
              key: "Enter",
              run: () => opts.onEnter?.(this as any, false, false) ?? false,
              shift: () => opts.onEnter?.(this as any, false, true) ?? false,
            },
            {
              key: "Mod-Enter",
              run: () => opts.onEnter?.(this as any, true, false) ?? false,
              shift: () => opts.onEnter?.(this as any, true, true) ?? false,
            },
            {
              key: "Escape",
              run: () => {
                opts.onEscape?.(this as any);
                return true;
              },
              preventDefault: true,
            },
          ]),
        ),
      );

      // Extra extensions (Tab navigation, etc.)
      if (opts.extraExtensions) {
        extensions.push(...opts.extraExtensions);
      }

      return extensions;
    }

    destroy(): void {
      if ((this as any)._loaded) this.unload();
      this.app.keymap.popScope(this.scope);
      (this.app.workspace as any).activeEditor = null;
      this.containerEl.empty();
      super.destroy();
    }

    onunload(): void {
      super.onunload();
      this.destroy();
    }
  } as any;

  return CachedEditorClass!;
}

// ─── Public factory ──────────────────────────────────────────────────────

export function createEmbeddableEditor(
  app: App,
  container: HTMLElement,
  options: EmbeddedEditorOptions,
): EmbeddableMarkdownEditor {
  const Cls = getEditorClass(app);
  return new Cls(app, container, options);
}
