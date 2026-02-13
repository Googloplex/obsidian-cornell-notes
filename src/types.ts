// ═══════════════════════════════════════════════════════════════════════════
// Cornell Notes — Data Model & Constants
// ═══════════════════════════════════════════════════════════════════════════

export const CORNELL_VIEW_TYPE = "cornell-notes-view";
export const CORNELL_EXTENSION = "cornell";
export const CORNELL_ICON = "layout-dashboard";

// ─── Data Model ──────────────────────────────────────────────────────────

export interface CornellData {
  cues: string;
  notes: string;
  summary: string;
  title: string;
  created: string;
  modified: string;
  tags: string[];
}

// ─── Factory ─────────────────────────────────────────────────────────────

export function createEmptyData(title: string = ""): CornellData {
  const now = new Date().toISOString();
  return {
    cues: "",
    notes: "",
    summary: "",
    title,
    created: now,
    modified: now,
    tags: [],
  };
}

// ─── Serialization ───────────────────────────────────────────────────────

export function parseData(raw: string): CornellData {
  if (!raw || !raw.trim()) {
    return createEmptyData();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      cues: parsed.cues ?? "",
      notes: parsed.notes ?? "",
      summary: parsed.summary ?? "",
      title: parsed.title ?? "",
      created: parsed.created ?? new Date().toISOString(),
      modified: parsed.modified ?? new Date().toISOString(),
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return createEmptyData();
  }
}

export function serializeData(data: CornellData): string {
  return JSON.stringify(data, null, 2);
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
