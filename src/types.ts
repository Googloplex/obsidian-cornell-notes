// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — Data Model & Constants
// ═══════════════════════════════════════════════════════════════════════════

export const CORNELL_VIEW_TYPE = "cornell-notes-view";
export const CORNELL_EXTENSION = "cornell";
export const CORNELL_ICON = "layout-dashboard";

// ─── Section definitions ─────────────────────────────────────────────────

export type SectionKey = "cues" | "notes" | "summary";

export const SECTIONS: Record<SectionKey, { suffix: string; label: string; type: string }> = {
  cues:    { suffix: "_cues.md",    label: "Вопросы / Идеи", type: "вопросы" },
  notes:   { suffix: "_notes.md",   label: "Конспект",       type: "конспект" },
  summary: { suffix: "_summary.md", label: "Резюме",         type: "резюме" },
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

/** Normalize tags for YAML frontmatter: strip #, split by comma/space, deduplicate */
function cleanTags(tags: string[]): string[] {
  const result: string[] = [];
  for (const raw of tags) {
    for (const t of raw.split(/[\s,]+/)) {
      const clean = t.replace(/^#/, "").trim();
      if (clean && !result.includes(clean)) result.push(clean);
    }
  }
  return result;
}

export function generateFrontmatter(section: SectionKey, cornellTitle: string, tags: string[] = []): string {
  const clean = cleanTags(tags);
  const lines = [
    "---",
    `type: cornell-${section}`,
    `cornell: "${cornellTitle}"`,
    `created: ${new Date().toISOString()}`,
  ];
  if (clean.length > 0) {
    lines.push(`tags: [${clean.join(", ")}]`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

export function updateFrontmatter(frontmatter: string, _sectionKey: SectionKey, tags: string[]): string {
  const clean = cleanTags(tags);
  let updated = frontmatter;

  // Remove existing tags line
  updated = updated.replace(/^tags:.*\n?/m, "");

  // Insert tags before closing ---
  if (clean.length > 0) {
    const tagsLine = `tags: [${clean.join(", ")}]`;
    updated = updated.replace(/---\n?$/, `${tagsLine}\n---\n`);
  }

  return updated;
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
