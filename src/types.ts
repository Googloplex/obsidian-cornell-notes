// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — Data Model & Constants
// ═══════════════════════════════════════════════════════════════════════════

export const CORNELL_VIEW_TYPE = "cornell-notes-view";
export const CORNELL_EXTENSION = "cornell";
export const CORNELL_ICON = "layout-dashboard";

// ─── Section definitions ─────────────────────────────────────────────────

export type SectionKey = "cues" | "notes" | "summary";

export const SECTIONS: Record<SectionKey, { suffix: string; label: string }> = {
  cues:    { suffix: "_cues.md",    label: "Вопросы / Идеи" },
  notes:   { suffix: "_notes.md",   label: "Конспект" },
  summary: { suffix: "_summary.md", label: "Резюме" },
};

export const SECTION_KEYS: SectionKey[] = ["cues", "notes", "summary"];

// ─── Manifest (.cornell) ────────────────────────────────────────────────

export interface CornellManifest {
  title: string;
  created: string;
  modified: string;
  tags: string[];
}

export function createManifest(title: string): CornellManifest {
  const now = new Date().toISOString();
  return { title, created: now, modified: now, tags: [] };
}

export function parseManifest(raw: string): CornellManifest {
  if (!raw || !raw.trim()) return createManifest("");
  try {
    const p = JSON.parse(raw);
    return {
      title: p.title ?? "",
      created: p.created ?? new Date().toISOString(),
      modified: p.modified ?? new Date().toISOString(),
      tags: Array.isArray(p.tags) ? p.tags : [],
    };
  } catch {
    return createManifest("");
  }
}

export function serializeManifest(m: CornellManifest): string {
  return JSON.stringify(m, null, 2);
}

// ─── File path helpers ──────────────────────────────────────────────────

export function sectionFilePath(folderPath: string, baseName: string, key: SectionKey): string {
  return `${folderPath}/${baseName}${SECTIONS[key].suffix}`;
}

export function generateFrontmatter(section: SectionKey, cornellTitle: string): string {
  return [
    "---",
    `type: cornell-${section}`,
    `cornell: "${cornellTitle}"`,
    `created: ${new Date().toISOString()}`,
    "---",
    "",
  ].join("\n");
}

export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? content.slice(match[0].length) : content;
}

// ─── Formatting helpers ──────────────────────────────────────────────────

export function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}
