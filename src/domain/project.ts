import { z } from "zod";

export const SAMPLE_LINE =
  "The tide swallowed the first stone before she reached it.";

const SAMPLE_SCENE = [
  "Nessa counted three lanterns along the causeway as dusk lowered over the inlet.",
  SAMPLE_LINE,
  "She tucked the paper map beneath her coat and waited for a bell that never rang.",
].join(" ");

const SAMPLE_OUTLINE = [
  "1. Nessa arrives at the tidal causeway before dusk.",
  "2. The expected bell does not ring; she chooses whether to cross.",
  "3. She returns with a clue, not a solution.",
].join("\n");

export const EDIT_LENSES = {
  plain: {
    label: "Plainer diction",
    suggestion: "The tide covered the first stone before she reached it.",
    rationale:
      "This trades a figurative verb for a literal one. Keep it only if the change suits your rhythm.",
  },
  motion: {
    label: "Keep the motion",
    suggestion: "The tide rolled over the first stone before she reached it.",
    rationale:
      "This keeps the water moving but changes the image. Decide whether it sounds like this scene.",
  },
} as const;

export type EditLens = keyof typeof EDIT_LENSES;

const revisionSchema = z
  .object({
    id: z.string().regex(/^r\d+$/),
    parentId: z.string().regex(/^r\d+$/).nullable(),
    scene: z.string(),
    source: z.enum(["example", "writer", "fixture-accepted", "writer-rewrite"]),
    createdAt: z.string().datetime(),
    proposalId: z.string().regex(/^p\d+$/).optional(),
  })
  .strict();

const proposalSchema = z
  .object({
    id: z.string().regex(/^p\d+$/),
    baseRevisionId: z.string().regex(/^r\d+$/),
    baseEpoch: z.number().int().nonnegative(),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    original: z.string(),
    suggestion: z.string(),
    rationale: z.string(),
    lens: z.enum(["plain", "motion"]),
    source: z.literal("offline-fixture"),
    contextEntryIds: z.array(z.string().regex(/^m\d+$/)),
    createdAt: z.string().datetime(),
  })
  .strict();

const decisionSchema = z
  .object({
    id: z.string().regex(/^d\d+$/),
    proposalId: z.string().regex(/^p\d+$/),
    action: z.enum(["rejected", "accepted", "rewritten"]),
    revisionId: z.string().regex(/^r\d+$/).optional(),
    createdAt: z.string().datetime(),
  })
  .strict();

const memorySchema = z
  .object({
    id: z.string().regex(/^m\d+$/),
    kind: z.enum(["preference", "continuity"]),
    text: z.string().trim().min(1).max(240),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict();

const navigationSchema = z
  .object({
    id: z.string().regex(/^n\d+$/),
    action: z.enum(["undo", "restore"]),
    fromRevisionId: z.string().regex(/^r\d+$/),
    toRevisionId: z.string().regex(/^r\d+$/),
    createdAt: z.string().datetime(),
  })
  .strict();

export const projectSchema = z
  .object({
    formatVersion: z.literal(1),
    outline: z.string(),
    draft: z.string(),
    revisions: z.array(revisionSchema).min(1),
    currentRevisionId: z.string().regex(/^r\d+$/),
    sceneEpoch: z.number().int().nonnegative(),
    proposals: z.array(proposalSchema),
    activeProposalId: z.string().regex(/^p\d+$/).nullable(),
    decisions: z.array(decisionSchema),
    memory: z.array(memorySchema),
    navigation: z.array(navigationSchema),
    nextId: z.number().int().positive(),
  })
  .strict()
  .superRefine((project, context) => {
    const ids = new Set<string>();
    let highestId = 0;
    const addId = (id: string) => {
      if (ids.has(id)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Repeated ID: ${id}` });
      }
      ids.add(id);
      highestId = Math.max(highestId, Number(id.slice(1)));
    };

    const earlierRevisions = new Set<string>();
    for (const [index, revision] of project.revisions.entries()) {
      addId(revision.id);
      if (
        (index === 0 && revision.parentId !== null) ||
        (index > 0 && (revision.parentId === null || !earlierRevisions.has(revision.parentId)))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid parent for ${revision.id}`,
        });
      }
      earlierRevisions.add(revision.id);
    }

    const revisions = new Map(project.revisions.map((revision) => [revision.id, revision]));
    if (!revisions.has(project.currentRevisionId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Current scene revision is missing",
      });
    }

    const memoryIds = new Set(project.memory.map((entry) => entry.id));
    for (const entry of project.memory) addId(entry.id);

    const proposals = new Map(project.proposals.map((proposal) => [proposal.id, proposal]));
    for (const proposal of project.proposals) {
      addId(proposal.id);
      const base = revisions.get(proposal.baseRevisionId);
      if (
        !base ||
        proposal.end <= proposal.start ||
        base.scene.slice(proposal.start, proposal.end) !== proposal.original
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid base passage for ${proposal.id}`,
        });
      }
      if (proposal.contextEntryIds.some((id) => !memoryIds.has(id))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Deleted context remains on ${proposal.id}`,
        });
      }
    }

    const decided = new Set<string>();
    for (const decision of project.decisions) {
      addId(decision.id);
      if (!proposals.has(decision.proposalId) || decided.has(decision.proposalId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid decision for ${decision.proposalId}`,
        });
      }
      decided.add(decision.proposalId);
      const revision = decision.revisionId && revisions.get(decision.revisionId);
      if (
        (decision.action === "rejected" && decision.revisionId !== undefined) ||
        (decision.action !== "rejected" &&
          (!revision ||
            revision.proposalId !== decision.proposalId ||
            revision.source !==
              (decision.action === "accepted" ? "fixture-accepted" : "writer-rewrite")))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid revision for ${decision.id}`,
        });
      }
    }

    for (const revision of project.revisions) {
      const fromProposal =
        revision.source === "fixture-accepted" || revision.source === "writer-rewrite";
      const matchingDecision = project.decisions.find(
        (decision) =>
          decision.revisionId === revision.id && decision.proposalId === revision.proposalId,
      );
      if (
        (fromProposal && (!revision.proposalId || !matchingDecision)) ||
        (!fromProposal && revision.proposalId !== undefined)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid attribution for ${revision.id}`,
        });
      }
    }

    const pending = project.proposals.filter((proposal) => !decided.has(proposal.id));
    if (
      pending.length > 1 ||
      (pending.length === 0 && project.activeProposalId !== null) ||
      (pending.length === 1 && project.activeProposalId !== pending[0].id)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Active proposal does not match undecided proposal",
      });
    }

    for (const visit of project.navigation) {
      addId(visit.id);
      if (!revisions.has(visit.fromRevisionId) || !revisions.has(visit.toRevisionId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid scene navigation ${visit.id}`,
        });
      }
    }

    if (project.nextId <= highestId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Next ID would overwrite history",
      });
    }
  });

export type StoryProject = z.infer<typeof projectSchema>;
export type SceneRevision = StoryProject["revisions"][number];
export type Proposal = StoryProject["proposals"][number];
export type MemoryKind = StoryProject["memory"][number]["kind"];
export type Transition =
  | { ok: true; project: StoryProject }
  | { ok: false; error: string };

const success = (project: StoryProject): Transition => ({ ok: true, project });
const failure = (error: string): Transition => ({ ok: false, error });
const now = () => new Date().toISOString();

export function createExampleProject(): StoryProject {
  return {
    formatVersion: 1,
    outline: SAMPLE_OUTLINE,
    draft: SAMPLE_SCENE,
    revisions: [
      {
        id: "r1",
        parentId: null,
        scene: SAMPLE_SCENE,
        source: "example",
        createdAt: now(),
      },
    ],
    currentRevisionId: "r1",
    sceneEpoch: 0,
    proposals: [],
    activeProposalId: null,
    decisions: [],
    memory: [],
    navigation: [],
    nextId: 2,
  };
}

export function currentRevision(project: StoryProject): SceneRevision {
  const revision = project.revisions.find((item) => item.id === project.currentRevisionId);
  if (!revision) throw new Error("Current scene revision is missing.");
  return revision;
}

export function activeProposal(project: StoryProject): Proposal | undefined {
  return project.proposals.find((item) => item.id === project.activeProposalId);
}

export function setOutline(project: StoryProject, outline: string): StoryProject {
  return { ...project, outline };
}

export function setDraft(project: StoryProject, draft: string): StoryProject {
  return { ...project, draft };
}

export function saveScene(project: StoryProject): Transition {
  const current = currentRevision(project);
  if (project.draft === current.scene) return failure("The scene has no unsaved changes.");
  const revision: SceneRevision = {
    id: `r${project.nextId}`,
    parentId: current.id,
    scene: project.draft,
    source: "writer",
    createdAt: now(),
  };
  return success({
    ...project,
    revisions: [...project.revisions, revision],
    currentRevisionId: revision.id,
    sceneEpoch: project.sceneEpoch + 1,
    nextId: project.nextId + 1,
  });
}

export function addMemory(
  project: StoryProject,
  kind: MemoryKind,
  text: string,
  enabled: boolean,
): Transition {
  const note = text.trim();
  if (!note || note.length > 240) return failure("Write a note of 1–240 characters.");
  return success({
    ...project,
    memory: [
      ...project.memory,
      { id: `m${project.nextId}`, kind, text: note, enabled, createdAt: now() },
    ],
    nextId: project.nextId + 1,
  });
}

export function setMemoryEnabled(
  project: StoryProject,
  id: string,
  enabled: boolean,
): Transition {
  if (!project.memory.some((entry) => entry.id === id)) return failure("Note not found.");
  return success({
    ...project,
    memory: project.memory.map((entry) => (entry.id === id ? { ...entry, enabled } : entry)),
  });
}

export function deleteMemory(project: StoryProject, id: string): Transition {
  if (!project.memory.some((entry) => entry.id === id)) return failure("Note not found.");
  return success({
    ...project,
    memory: project.memory.filter((entry) => entry.id !== id),
    proposals: project.proposals.map((proposal) => ({
      ...proposal,
      contextEntryIds: proposal.contextEntryIds.filter((entryId) => entryId !== id),
    })),
  });
}

export function proposeOffline(
  project: StoryProject,
  start: number,
  end: number,
  lens: EditLens,
): Transition {
  const current = currentRevision(project);
  if (project.activeProposalId) return failure("Decide the open proposal before asking again.");
  if (project.draft !== current.scene) {
    return failure("Save your scene revision before requesting an edit.");
  }
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end > current.scene.length ||
    current.scene.slice(start, end) !== SAMPLE_LINE
  ) {
    return failure(
      "This offline fixture only knows the exact example sentence. Select it, including the period.",
    );
  }
  const variant = EDIT_LENSES[lens];
  const proposal: Proposal = {
    id: `p${project.nextId}`,
    baseRevisionId: current.id,
    baseEpoch: project.sceneEpoch,
    start,
    end,
    original: SAMPLE_LINE,
    suggestion: variant.suggestion,
    rationale: variant.rationale,
    lens,
    source: "offline-fixture",
    contextEntryIds: project.memory.filter((entry) => entry.enabled).map((entry) => entry.id),
    createdAt: now(),
  };
  return success({
    ...project,
    proposals: [...project.proposals, proposal],
    activeProposalId: proposal.id,
    nextId: project.nextId + 1,
  });
}

export function isProposalStale(project: StoryProject, proposal: Proposal): boolean {
  const current = currentRevision(project);
  return (
    current.id !== proposal.baseRevisionId ||
    project.sceneEpoch !== proposal.baseEpoch ||
    project.draft !== current.scene ||
    current.scene.slice(proposal.start, proposal.end) !== proposal.original
  );
}

export function rejectProposal(project: StoryProject): Transition {
  const proposal = activeProposal(project);
  if (!proposal) return failure("There is no open proposal to reject.");
  return success({
    ...project,
    decisions: [
      ...project.decisions,
      { id: `d${project.nextId}`, proposalId: proposal.id, action: "rejected", createdAt: now() },
    ],
    activeProposalId: null,
    nextId: project.nextId + 1,
  });
}

function applyProposal(
  project: StoryProject,
  action: "accepted" | "rewritten",
  replacement: string,
): Transition {
  const proposal = activeProposal(project);
  if (!proposal) return failure("There is no open proposal to apply.");
  if (isProposalStale(project, proposal)) {
    return failure("This proposal is stale. Reject it, then request a new one from a saved scene.");
  }
  if (
    action === "rewritten" &&
    (!replacement.trim() || replacement === proposal.original || replacement === proposal.suggestion)
  ) {
    return failure("Write different wording of your own, or choose Accept or Reject.");
  }
  const current = currentRevision(project);
  const revision: SceneRevision = {
    id: `r${project.nextId}`,
    parentId: current.id,
    scene:
      current.scene.slice(0, proposal.start) +
      replacement +
      current.scene.slice(proposal.end),
    source: action === "accepted" ? "fixture-accepted" : "writer-rewrite",
    proposalId: proposal.id,
    createdAt: now(),
  };
  return success({
    ...project,
    draft: revision.scene,
    revisions: [...project.revisions, revision],
    currentRevisionId: revision.id,
    sceneEpoch: project.sceneEpoch + 1,
    decisions: [
      ...project.decisions,
      {
        id: `d${project.nextId + 1}`,
        proposalId: proposal.id,
        action,
        revisionId: revision.id,
        createdAt: now(),
      },
    ],
    activeProposalId: null,
    nextId: project.nextId + 2,
  });
}

export function acceptProposal(project: StoryProject): Transition {
  const proposal = activeProposal(project);
  if (!proposal) return failure("There is no open proposal to accept.");
  return applyProposal(project, "accepted", proposal.suggestion);
}

export function rewriteProposal(project: StoryProject, writerText: string): Transition {
  return applyProposal(project, "rewritten", writerText);
}

function navigateScene(
  project: StoryProject,
  target: SceneRevision,
  action: "undo" | "restore",
): Transition {
  const current = currentRevision(project);
  if (project.draft !== current.scene) {
    return failure("Save or discard your unsaved scene edits before changing revisions.");
  }
  if (target.id === current.id) return failure("That scene revision is already open.");
  return success({
    ...project,
    currentRevisionId: target.id,
    draft: target.scene,
    sceneEpoch: project.sceneEpoch + 1,
    navigation: [
      ...project.navigation,
      {
        id: `n${project.nextId}`,
        action,
        fromRevisionId: current.id,
        toRevisionId: target.id,
        createdAt: now(),
      },
    ],
    nextId: project.nextId + 1,
  });
}

export function undoScene(project: StoryProject): Transition {
  const parentId = currentRevision(project).parentId;
  if (!parentId) return failure("This is the first scene revision.");
  const parent = project.revisions.find((revision) => revision.id === parentId);
  if (!parent) throw new Error("Parent scene revision is missing.");
  return navigateScene(project, parent, "undo");
}

export function restoreScene(project: StoryProject, revisionId: string): Transition {
  const target = project.revisions.find((revision) => revision.id === revisionId);
  if (!target) return failure("Scene revision not found.");
  return navigateScene(project, target, "restore");
}
