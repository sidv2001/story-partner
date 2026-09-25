import { beforeEach, describe, expect, it } from "vitest";
import {
  SAMPLE_LINE,
  acceptProposal,
  addMemory,
  createExampleProject,
  proposeOffline,
  setDraft,
  setOutline,
  type StoryProject,
  type Transition,
} from "../domain/project";
import { loadProject, parseBackup, saveProject, STORAGE_KEY } from "./local";

function resultProject(result: Transition): StoryProject {
  if (!result.ok) throw new Error(result.error);
  return result.project;
}

beforeEach(() => window.localStorage.clear());

describe("local project backups", () => {
  it("round-trips revision, decision, and memory provenance exactly", () => {
    let project = resultProject(addMemory(createExampleProject(), "preference", "Keep verbs concrete", true));
    const start = project.draft.indexOf(SAMPLE_LINE);
    project = resultProject(proposeOffline(project, start, start + SAMPLE_LINE.length, "motion"));
    project = resultProject(acceptProposal(project));
    project = setOutline(project, "1. A new beat chosen by the writer.");
    project = setDraft(project, `${project.draft}\nAn unsaved new line.`);
    const raw = JSON.stringify(project);

    expect(parseBackup(raw)).toEqual({ ok: true, project });
    saveProject(project);
    expect(loadProject()).toEqual({ kind: "ready", project });
  });

  it("does not replace malformed saved data with an example", () => {
    window.localStorage.setItem(STORAGE_KEY, "{this is not json");
    expect(loadProject()).toMatchObject({ kind: "blocked", raw: "{this is not json" });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("{this is not json");
  });

  it("rejects structurally invalid backups and broken revision links", () => {
    const project = createExampleProject();
    expect(parseBackup(JSON.stringify({ ...project, formatVersion: 2 })).ok).toBe(false);
    expect(
      parseBackup(
        JSON.stringify({
          ...project,
          revisions: [{ ...project.revisions[0], parentId: "r99" }],
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseBackup(
        JSON.stringify({
          ...project,
          revisions: [{ ...project.revisions[0], source: "fixture-accepted" }],
        }),
      ).ok,
    ).toBe(false);
    expect(parseBackup("not-json").ok).toBe(false);
  });
});
