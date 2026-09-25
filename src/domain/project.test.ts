import { describe, expect, it } from "vitest";
import {
  EDIT_LENSES,
  SAMPLE_LINE,
  acceptProposal,
  activeProposal,
  addMemory,
  createExampleProject,
  currentRevision,
  deleteMemory,
  isProposalStale,
  projectSchema,
  proposeOffline,
  rejectProposal,
  restoreScene,
  rewriteProposal,
  saveScene,
  setDraft,
  setMemoryEnabled,
  undoScene,
  type StoryProject,
  type Transition,
} from "./project";

function resultProject(result: Transition): StoryProject {
  if (!result.ok) throw new Error(result.error);
  return result.project;
}

function withProposal(project = createExampleProject()): StoryProject {
  const start = project.draft.indexOf(SAMPLE_LINE);
  return resultProject(proposeOffline(project, start, start + SAMPLE_LINE.length, "plain"));
}

describe("scene decisions and exact snapshots", () => {
  it("rejects without changing either the scene draft or any revision", () => {
    const offered = withProposal();
    const draft = offered.draft;
    const revisions = offered.revisions;
    const epoch = offered.sceneEpoch;
    const rejected = resultProject(rejectProposal(offered));

    expect(rejected.draft).toBe(draft);
    expect(rejected.revisions).toBe(revisions);
    expect(rejected.currentRevisionId).toBe(offered.currentRevisionId);
    expect(rejected.sceneEpoch).toBe(epoch);
    expect(rejected.decisions.at(-1)).toMatchObject({
      proposalId: offered.activeProposalId,
      action: "rejected",
    });
    expect(rejected.activeProposalId).toBeNull();
    expect(projectSchema.safeParse(rejected).success).toBe(true);
  });

  it("accepts only the selected span, then undo restores the exact base", () => {
    const offered = withProposal();
    const base = offered.draft;
    const accepted = resultProject(acceptProposal(offered));
    const acceptedId = accepted.currentRevisionId;

    expect(accepted.draft).toBe(base.replace(SAMPLE_LINE, EDIT_LENSES.plain.suggestion));
    expect(currentRevision(accepted)).toMatchObject({
      parentId: offered.currentRevisionId,
      source: "fixture-accepted",
      proposalId: offered.activeProposalId,
    });
    expect(accepted.decisions.at(-1)?.action).toBe("accepted");

    const undone = resultProject(undoScene(accepted));
    expect(undone.draft).toBe(base);
    expect(currentRevision(undone).scene).toBe(base);
    expect(undone.revisions.find((revision) => revision.id === acceptedId)?.scene).toBe(
      accepted.draft,
    );
    expect(undone.navigation.at(-1)).toMatchObject({
      action: "undo",
      fromRevisionId: acceptedId,
      toRevisionId: offered.currentRevisionId,
    });
    expect(projectSchema.safeParse(undone).success).toBe(true);
  });

  it("refuses a stale proposal after editing, saving, and undoing to identical text", () => {
    const offered = withProposal();
    const dirty = setDraft(offered, `${offered.draft} Another line.`);
    expect(isProposalStale(dirty, activeProposal(dirty)!)).toBe(true);
    expect(acceptProposal(dirty)).toMatchObject({ ok: false, error: expect.stringContaining("stale") });

    const saved = resultProject(saveScene(dirty));
    expect(acceptProposal(saved).ok).toBe(false);
    const undone = resultProject(undoScene(saved));
    expect(undone.draft).toBe(offered.draft);
    expect(undone.currentRevisionId).toBe(offered.currentRevisionId);
    expect(undone.sceneEpoch).toBeGreaterThan(offered.sceneEpoch);
    expect(acceptProposal(undone).ok).toBe(false);
    expect(undone.decisions).toEqual([]);
    expect(resultProject(rejectProposal(undone)).draft).toBe(offered.draft);
  });

  it("credits a writer rewrite to the writer while preserving the proposal link", () => {
    const offered = withProposal();
    const ownWords = "Before she reached it, the tide covered the first stone.";

    expect(rewriteProposal(offered, EDIT_LENSES.plain.suggestion).ok).toBe(false);
    const rewritten = resultProject(rewriteProposal(offered, ownWords));
    expect(rewritten.draft).toBe(offered.draft.replace(SAMPLE_LINE, ownWords));
    expect(currentRevision(rewritten)).toMatchObject({
      source: "writer-rewrite",
      proposalId: offered.activeProposalId,
    });
    expect(rewritten.proposals.at(-1)?.source).toBe("offline-fixture");
    expect(rewritten.decisions.at(-1)).toMatchObject({
      action: "rewritten",
      revisionId: rewritten.currentRevisionId,
    });
    expect(projectSchema.safeParse(rewritten).success).toBe(true);
  });

  it("preserves both branches when the writer returns to an earlier scene", () => {
    const original = createExampleProject();
    const accepted = resultProject(acceptProposal(withProposal(original)));
    const branchId = accepted.currentRevisionId;
    const back = resultProject(undoScene(accepted));
    const newDraft = setDraft(back, `${back.draft}\nNessa turned back.`);
    const newBranch = resultProject(saveScene(newDraft));

    expect(currentRevision(newBranch).parentId).toBe(original.currentRevisionId);
    expect(newBranch.revisions.find((revision) => revision.id === branchId)?.scene).toBe(
      accepted.draft,
    );
    expect(restoreScene(setDraft(newBranch, "unsaved"), branchId).ok).toBe(false);
    const restored = resultProject(restoreScene(newBranch, branchId));
    expect(restored.draft).toBe(accepted.draft);
    expect(restored.navigation.at(-1)?.action).toBe("restore");
  });
});

describe("consentful memory and fixture scope", () => {
  it("attaches only enabled notes and scrubs deleted note text from past proposals", () => {
    let project = resultProject(addMemory(createExampleProject(), "preference", "Keep imagery spare", true));
    const preferenceId = project.memory[0].id;
    project = resultProject(setMemoryEnabled(project, preferenceId, false));
    project = resultProject(addMemory(project, "continuity", "The bell has not rung", true));
    const factId = project.memory[1].id;

    const offered = withProposal(project);
    expect(activeProposal(offered)?.contextEntryIds).toEqual([factId]);
    const deleted = resultProject(deleteMemory(offered, factId));
    expect(activeProposal(deleted)?.contextEntryIds).toEqual([]);
    expect(JSON.stringify(deleted)).not.toContain("The bell has not rung");
    expect(projectSchema.safeParse(deleted).success).toBe(true);
  });

  it("never manufactures an edit for a writer's other text", () => {
    const project = createExampleProject();
    const before = project.draft;
    const result = proposeOffline(project, 0, 5, "plain");
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("only knows") });
    expect(project.draft).toBe(before);
    expect(project.proposals).toEqual([]);
  });
});
