import { createExampleProject, projectSchema, type StoryProject } from "../domain/project";

export const STORAGE_KEY = "story-partner:project:v1";

export type LoadedProject =
  | { kind: "ready"; project: StoryProject }
  | { kind: "blocked"; error: string; raw: string | null };

export type ParsedBackup =
  | { ok: true; project: StoryProject }
  | { ok: false; error: string };

export function parseBackup(raw: string): ParsedBackup {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, error: "This file is not valid JSON." };
    throw error;
  }
  const parsed = projectSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: "This is not a valid StoryPartner v1 project. No local data was changed.",
    };
  }
  return { ok: true, project: parsed.data };
}

export function loadProject(): LoadedProject {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return { kind: "blocked", error: `Browser storage is unavailable: ${errorText(error)}`, raw: null };
  }
  if (raw === null) return { kind: "ready", project: createExampleProject() };
  const parsed = parseBackup(raw);
  return parsed.ok
    ? { kind: "ready", project: parsed.project }
    : { kind: "blocked", error: parsed.error, raw };
}

export function saveProject(project: StoryProject): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function eraseProject(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
