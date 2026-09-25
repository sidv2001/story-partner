import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import RevisionTimeline from "./components/RevisionTimeline";
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
  proposeOffline,
  rejectProposal,
  restoreScene,
  rewriteProposal,
  saveScene,
  setDraft,
  setMemoryEnabled,
  setOutline,
  undoScene,
  type EditLens,
  type MemoryKind,
  type SceneRevision,
  type StoryProject,
  type Transition,
} from "./domain/project";
import {
  eraseProject,
  errorText,
  loadProject,
  parseBackup,
  saveProject,
  type LoadedProject,
} from "./storage/local";

type Notice = { kind: "success" | "error"; text: string } | null;

const SOURCE_LABELS: Record<SceneRevision["source"], string> = {
  example: "Original example",
  writer: "Writer draft",
  "fixture-accepted": "Offline proposal accepted by writer",
  "writer-rewrite": "Writer rewrite informed by offline proposal",
};

function downloadFile(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [loaded, setLoaded] = useState<LoadedProject>(() => loadProject());
  const project = loaded.kind === "ready" ? loaded.project : null;
  const [notice, setNotice] = useState<Notice>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [selectedLength, setSelectedLength] = useState(0);
  const [lens, setLens] = useState<EditLens>("plain");
  const [rewrite, setRewrite] = useState("");
  const [memoryKind, setMemoryKind] = useState<MemoryKind>("preference");
  const [memoryText, setMemoryText] = useState("");
  const [enableMemory, setEnableMemory] = useState(false);
  const [pendingImport, setPendingImport] = useState<StoryProject | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!project) return;
    try {
      saveProject(project);
      setStorageError(null);
    } catch (error) {
      setStorageError(
        `Browser save failed (${errorText(error)}). Your changes are in this tab only; export a backup now.`,
      );
    }
  }, [project]);

  function updateProject(next: StoryProject): void {
    setLoaded({ kind: "ready", project: next });
  }

  function act(result: Transition, message: string): boolean {
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return false;
    }
    updateProject(result.project);
    setNotice({ kind: "success", text: message });
    return true;
  }

  function selectExampleSentence(): void {
    if (!project || !editorRef.current) return;
    const start = project.draft.indexOf(SAMPLE_LINE);
    if (start < 0) {
      setNotice({
        kind: "error",
        text: "The example sentence is no longer in this scene. Restore the example revision to try its fixture.",
      });
      return;
    }
    editorRef.current.focus();
    editorRef.current.setSelectionRange(start, start + SAMPLE_LINE.length);
    setSelectedLength(SAMPLE_LINE.length);
    setNotice(null);
  }

  function requestSuggestion(): void {
    if (!project || !editorRef.current) return;
    const { selectionStart, selectionEnd } = editorRef.current;
    if (act(proposeOffline(project, selectionStart, selectionEnd, lens), "A reviewable proposal is ready.")) {
      setRewrite("");
    }
  }

  function addNote(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!project) return;
    if (act(addMemory(project, memoryKind, memoryText, enableMemory), "Your note was saved locally.")) {
      setMemoryText("");
      setEnableMemory(false);
    }
  }

  function exportProject(): void {
    if (!project) return;
    try {
      downloadFile(
        `story-partner-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(project, null, 2),
      );
      setNotice({ kind: "success", text: "Backup downloaded. Keep the file somewhere private." });
    } catch (error) {
      setNotice({ kind: "error", text: `Export failed: ${errorText(error)}` });
    }
  }

  async function chooseImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPendingImport(null);
    if (file.size > 2_000_000) {
      setNotice({ kind: "error", text: "This small-scene demo accepts backups up to 2 MB." });
      input.value = "";
      return;
    }
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setNotice({ kind: "error", text: parsed.error });
      } else {
        setPendingImport(parsed.project);
        setNotice({
          kind: "success",
          text: "Backup checked. Your current project is unchanged until you choose Replace.",
        });
      }
    } catch (error) {
      setNotice({ kind: "error", text: `Import failed: ${errorText(error)}` });
    }
    input.value = "";
  }

  function eraseAndRestart(): void {
    if (
      !window.confirm(
        "Erase this browser's StoryPartner project and start a new example? Export first if you want a copy.",
      )
    ) {
      return;
    }
    try {
      eraseProject();
      updateProject(createExampleProject());
      setPendingImport(null);
      setRewrite("");
      setNotice({ kind: "success", text: "Local project erased. A fresh example is open." });
    } catch (error) {
      setNotice({ kind: "error", text: `Could not erase browser storage: ${errorText(error)}` });
    }
  }

  if (!project) {
    if (loaded.kind !== "blocked") throw new Error("Project load state is inconsistent.");
    const unreadableCopy = loaded.raw;
    return (
      <main className="recovery">
        <span className="eyebrow">StoryPartner · local recovery</span>
        <h1>Your saved project needs attention.</h1>
        <p>{loaded.error} We have not overwritten it.</p>
        {notice && <p role="alert" className="notice notice-error">{notice.text}</p>}
        {unreadableCopy !== null && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              try {
                downloadFile("story-partner-unreadable-backup.json", unreadableCopy);
              } catch (error) {
                setNotice({ kind: "error", text: `Export failed: ${errorText(error)}` });
              }
            }}
          >
            Download unreadable copy
          </button>
        )}
        <button type="button" className="button button-primary" onClick={eraseAndRestart}>
          Erase saved copy and open example
        </button>
        {unreadableCopy === null && (
          <button
            type="button"
            className="button button-text"
            onClick={() => {
              updateProject(createExampleProject());
              setNotice({ kind: "error", text: "Browser storage is unavailable; export before closing this tab." });
            }}
          >
            Open an unsaved example instead
          </button>
        )}
      </main>
    );
  }

  const current = currentRevision(project);
  const proposal = activeProposal(project);
  const dirty = project.draft !== current.scene;
  const stale = proposal ? isProposalStale(project, proposal) : false;

  return (
    <div className="site-shell">
      <a className="skip-link" href="#workbench">Skip to writing desk</a>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="StoryPartner, back to top">
          <span className="wordmark-symbol" aria-hidden="true">✳</span>
          <span>story<span className="wordmark-accent">partner</span></span>
        </a>
        <nav aria-label="Page sections" className="site-nav">
          <a href="#outline">Outline</a>
          <a href="#workbench">Writing desk</a>
          <a href="#memory">Memory</a>
          <a href="#history">History</a>
        </nav>
        <span className="offline-pill"><span aria-hidden="true" className="offline-dot" /> Offline studio</span>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">For the books you want to write yourself</span>
            <h1 id="hero-title">Write the story.<br /><em>Keep the say.</em></h1>
            <p>
              Start with a few beats and one scene. Ask for a small edit, consider it beside
              your draft, and choose what stays. The next sentence is still yours to decide.
            </p>
            <a className="button button-primary hero-link" href="#workbench">
              Open the writing desk <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="hero-note" aria-label="The writing loop">
            <span className="hero-note-kicker">A small writing loop</span>
            <span className="hero-note-line">01 <strong>Set the direction</strong></span>
            <span className="hero-note-line">02 <strong>Consider one edit</strong></span>
            <span className="hero-note-line">03 <strong>Keep or undo</strong></span>
            <p>One scene at a time. No model connection in this starter.</p>
          </div>
        </section>

        <div className="workspace-intro">
          <span className="eyebrow">Your workspace</span>
          <p>
            The starting outline and scene are an <strong>original fictional example</strong>.
            Replace them with your own writing whenever you like.
          </p>
        </div>

        {(notice || storageError) && (
          <div className="notices" aria-live="polite">
            {notice && (
              <p className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
                {notice.text}
              </p>
            )}
            {storageError && <p className="notice notice-error" role="alert">{storageError}</p>}
          </div>
        )}

        <section id="outline" className="section section-outline" aria-labelledby="outline-title">
          <div className="section-heading">
            <span className="section-number">01 / THE PLAN</span>
            <div>
              <h2 id="outline-title">Find the spine of it.</h2>
              <p>Put down the beats you want to follow. They can change as the story does.</p>
            </div>
          </div>
          <div className="outline-paper">
            <label htmlFor="outline-text">Story outline</label>
            <textarea
              id="outline-text"
              value={project.outline}
              onChange={(event) => updateProject(setOutline(project, event.target.value))}
              rows={5}
              spellCheck={false}
              aria-describedby="outline-help"
            />
            <p id="outline-help" className="field-help">Saved in this browser as you type. Scene versions are tracked separately.</p>
          </div>
        </section>

        <section id="workbench" className="section section-workbench" aria-labelledby="desk-title">
          <div className="section-heading">
            <span className="section-number">02 / THE DESK</span>
            <div>
              <h2 id="desk-title">Stay with the sentence.</h2>
              <p>Suggestions sit beside the draft until you make a decision.</p>
            </div>
          </div>
          <div className="desk-grid">
            <div className="panel draft-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Your page</span>
                  <h3>Scene draft</h3>
                </div>
                <span className="revision-badge">{current.id}{dirty ? " · unsaved" : " · saved"}</span>
              </div>
              <label className="visually-hidden" htmlFor="scene-text">Scene draft</label>
              <textarea
                id="scene-text"
                ref={editorRef}
                className="scene-editor"
                value={project.draft}
                onChange={(event) => updateProject(setDraft(project, event.target.value))}
                onSelect={(event) => setSelectedLength(event.currentTarget.selectionEnd - event.currentTarget.selectionStart)}
                spellCheck={false}
                aria-describedby="scene-help"
              />
              <p id="scene-help" className="field-help">
                Select the example sentence for the offline edit. Scene changes become versions when saved.
                <span className="selection-count"> {selectedLength} characters selected.</span>
              </p>
              <div className="editor-actions">
                <button type="button" className="button button-secondary" onClick={() => act(saveScene(project), "Scene revision saved.")}>
                  Save scene revision
                </button>
                <button
                  type="button"
                  className="button button-text"
                  disabled={!dirty}
                  onClick={() => {
                    updateProject(setDraft(project, current.scene));
                    setNotice({ kind: "success", text: "Unsaved scene edits discarded." });
                  }}
                >
                  Discard unsaved
                </button>
                <button
                  type="button"
                  className="button button-text"
                  disabled={!current.parentId}
                  onClick={() => act(undoScene(project), "Previous scene revision restored exactly.")}
                >
                  Undo scene revision
                </button>
              </div>
            </div>

            <div className="panel proposal-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">A choice, not a change</span>
                  <h3>Suggestion desk</h3>
                </div>
                <span className="fixture-badge">Offline fixture</span>
              </div>
              {proposal ? (
                <div className="proposal-content">
                  {stale && (
                    <p className="stale-warning" role="status">
                      This proposal no longer matches the saved scene. Accept and rewrite are blocked;
                      reject it to ask again.
                    </p>
                  )}
                  <span className="comparison-label">Selected from your scene</span>
                  <blockquote className="comparison-original">{proposal.original}</blockquote>
                  <span className="comparison-label">Possible replacement · {EDIT_LENSES[proposal.lens].label}</span>
                  <blockquote className="comparison-suggestion">{proposal.suggestion}</blockquote>
                  <p className="proposal-reason">{proposal.rationale}</p>
                  <p className="context-note">
                    {proposal.contextEntryIds.length
                      ? `Notes attached at request: ${proposal.contextEntryIds
                          .map((id) => project.memory.find((entry) => entry.id === id)?.text)
                          .filter(Boolean)
                          .join("; ")}. The offline fixture does not interpret them.`
                      : "No memory notes attached. The offline fixture does not interpret notes."}
                  </p>
                  <div className="decision-actions">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => {
                        if (act(acceptProposal(project), "Accepted edit saved as a new scene revision.")) {
                          setSelectedLength(0);
                        }
                      }}
                    >
                      Accept edit
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => act(rejectProposal(project), "Proposal rejected; no scene edit was made.")}
                    >
                      Reject
                    </button>
                  </div>
                  <label htmlFor="rewrite-text" className="rewrite-label">Or write your own line</label>
                  <textarea
                    id="rewrite-text"
                    value={rewrite}
                    onChange={(event) => setRewrite(event.target.value)}
                    rows={3}
                    placeholder="Your words here"
                    spellCheck={false}
                    aria-describedby="rewrite-help"
                  />
                  <p id="rewrite-help" className="field-help">A rewrite is credited to you, with its proposal still visible in history.</p>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                      if (act(rewriteProposal(project, rewrite), "Your rewrite saved with its proposal credited separately.")) {
                        setRewrite("");
                        setSelectedLength(0);
                      }
                    }}
                  >
                    Use my rewrite
                  </button>
                </div>
              ) : (
                <div className="proposal-empty">
                  <p className="proposal-prompt">One small edit, only when you ask for it.</p>
                  <p>
                    Choose a lens, select the example sentence in your scene, and see a
                    possible replacement here before it touches the page.
                  </p>
                  <label htmlFor="edit-lens">Editing lens</label>
                  <select
                    id="edit-lens"
                    value={lens}
                    onChange={(event) => {
                      const choice = event.target.value;
                      if (choice === "plain" || choice === "motion") setLens(choice);
                      else setNotice({ kind: "error", text: "Unsupported editing lens." });
                    }}
                  >
                    {Object.entries(EDIT_LENSES).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                  <div className="request-actions">
                    <button type="button" className="button button-text" onClick={selectExampleSentence}>
                      Select example sentence
                    </button>
                    <button type="button" className="button button-primary" onClick={requestSuggestion}>
                      Show offline suggestion
                    </button>
                  </div>
                  <p className="field-help">For this first version, the fixture recognizes only that sentence. Your own text is never sent to a model.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="memory" className="section section-memory" aria-labelledby="memory-title">
          <div className="section-heading">
            <span className="section-number">03 / THE LEDGER</span>
            <div>
              <h2 id="memory-title">Remember what you choose.</h2>
              <p>Keep a style preference or a story fact in view. Switch it off or delete it at any time.</p>
            </div>
          </div>
          <div className="memory-grid">
            <form className="panel memory-form" onSubmit={addNote}>
              <h3>Add a note</h3>
              <label htmlFor="memory-kind">This is a</label>
              <select
                id="memory-kind"
                value={memoryKind}
                onChange={(event) => {
                  const kind = event.target.value;
                  if (kind === "preference" || kind === "continuity") setMemoryKind(kind);
                  else setNotice({ kind: "error", text: "Unsupported note type." });
                }}
              >
                <option value="preference">Style preference</option>
                <option value="continuity">Continuity fact</option>
              </select>
              <label htmlFor="memory-text">Your note</label>
              <textarea
                id="memory-text"
                value={memoryText}
                maxLength={240}
                onChange={(event) => setMemoryText(event.target.value)}
                placeholder={memoryKind === "preference" ? "e.g. Keep descriptions spare" : "e.g. The causeway floods at dusk"}
                rows={3}
                spellCheck={false}
              />
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={enableMemory}
                  onChange={(event) => setEnableMemory(event.target.checked)}
                />
                Attach this note to future requests
              </label>
              <button type="submit" className="button button-primary">Save note</button>
              <p className="field-help">New notes start off unless you opt in. They are never inferred from your draft.</p>
            </form>
            <div className="panel ledger-panel">
              <div className="panel-heading">
                <h3>Approved by you</h3>
                <span className="ledger-count">{project.memory.length} notes</span>
              </div>
              {project.memory.length === 0 ? (
                <p className="ledger-empty">Nothing in the ledger yet. That is a good place to start.</p>
              ) : (
                <div className="ledger-groups">
                  {(["preference", "continuity"] as const).map((kind) => {
                    const entries = project.memory.filter((entry) => entry.kind === kind);
                    return (
                      <div key={kind}>
                        <h4>{kind === "preference" ? "Style preferences" : "Continuity facts"}</h4>
                        {entries.length === 0 ? (
                          <p className="field-help">No notes here.</p>
                        ) : (
                          <ul className="ledger-list">
                            {entries.map((entry) => (
                              <li key={entry.id} className="ledger-entry">
                                <p>{entry.text}</p>
                                <div className="ledger-controls">
                                  <label className="checkbox-row">
                                    <input
                                      type="checkbox"
                                      checked={entry.enabled}
                                      onChange={(event) =>
                                        act(
                                          setMemoryEnabled(project, entry.id, event.target.checked),
                                          event.target.checked ? "Note enabled for future requests." : "Note disabled for future requests.",
                                        )
                                      }
                                      aria-label={`Attach note to requests: ${entry.text}`}
                                    />
                                    {entry.enabled ? "On" : "Off"}
                                  </label>
                                  <button
                                    type="button"
                                    className="button button-text button-small"
                                    onClick={() => act(deleteMemory(project, entry.id), "Note and its proposal references deleted.")}
                                    aria-label={`Delete note: ${entry.text}`}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="field-help">Enabled notes are listed with new fixture requests, but this fixture does not read or interpret them.</p>
            </div>
          </div>
        </section>

        <section id="history" className="section section-history" aria-labelledby="history-title">
          <div className="section-heading">
            <span className="section-number">04 / THE RECORD</span>
            <div>
              <h2 id="history-title">Every choice has a way back.</h2>
              <p>Scene snapshots remain intact. Undo moves to a parent; Restore can open any saved branch.</p>
            </div>
          </div>
          <div className="history-grid">
            <div className="panel history-panel">
              <h3>Scene revisions</h3>
              <ol className="history-list">
                {project.revisions.slice().reverse().map((revision) => (
                  <li key={revision.id}>
                    <div className="history-row">
                      <span className="history-id">{revision.id}</span>
                      <div className="history-detail">
                        <strong>{SOURCE_LABELS[revision.source]}</strong>
                        <span>
                          {revision.parentId ? `From ${revision.parentId}` : "Starting example"}
                          {revision.proposalId ? ` · linked to ${revision.proposalId}` : ""}
                        </span>
                      </div>
                      {revision.id === current.id ? (
                        <span className="current-tag">Current</span>
                      ) : (
                        <button
                          type="button"
                          className="button button-text button-small"
                          onClick={() => act(restoreScene(project, revision.id), `${revision.id} restored exactly.`)}
                          aria-label={`Restore scene ${revision.id}`}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                    <details>
                      <summary>Read saved scene</summary>
                      <pre>{revision.scene}</pre>
                    </details>
                  </li>
                ))}
              </ol>
              {project.navigation.length > 0 && (
                <p className="field-help">
                  {project.navigation.length} undo/restore actions recorded in the backup.
                </p>
              )}
            </div>
            <div className="panel history-panel">
              <h3>Suggestion decisions</h3>
              {project.decisions.length === 0 ? (
                <p className="ledger-empty">Your decisions will appear here after the first proposal.</p>
              ) : (
                <ol className="decision-list">
                  {project.decisions.slice().reverse().map((decision) => {
                    const decidedProposal = project.proposals.find((item) => item.id === decision.proposalId);
                    if (!decidedProposal) throw new Error("Decision proposal is missing.");
                    return (
                      <li key={decision.id}>
                        <strong>{decision.proposalId} · {decision.action}</strong>
                        <span>
                          {decision.revisionId ? `Scene ${decision.revisionId}` : "No scene revision"}
                          {" · "}offline fixture
                        </span>
                        <details>
                          <summary>See the suggestion and outcome</summary>
                          <p>Selected: {decidedProposal.original}</p>
                          <p>Proposed: {decidedProposal.suggestion}</p>
                          {decision.action === "rewritten" && (
                            <p>The writer supplied different wording; see the linked scene revision.</p>
                          )}
                        </details>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
          <RevisionTimeline />
        </section>

        <section className="section section-backup" aria-labelledby="backup-title">
          <div className="section-heading">
            <span className="section-number">05 / YOUR COPY</span>
            <div>
              <h2 id="backup-title">Keep your work close.</h2>
              <p>Browser storage is convenient, not a backup. Export a private copy when it matters.</p>
            </div>
          </div>
          <div className="panel backup-panel">
            <div>
              <h3>Project backup</h3>
              <p>The JSON includes your outline, draft, scene snapshots, decisions, and notes. Nothing uploads on export or import.</p>
            </div>
            <div className="backup-actions">
              <button type="button" className="button button-primary" onClick={exportProject}>Export JSON</button>
              <label htmlFor="import-file">Choose a StoryPartner backup</label>
              <input id="import-file" type="file" accept=".json,application/json" onChange={chooseImport} />
              {pendingImport && (
                <div className="import-confirm">
                  <p>
                    Ready to import {pendingImport.revisions.length} scene revisions and {pendingImport.memory.length} notes.
                    This replaces the local project.
                  </p>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                      updateProject(pendingImport);
                      setPendingImport(null);
                      setRewrite("");
                      setNotice({ kind: "success", text: "Backup imported into this browser." });
                    }}
                  >
                    Replace with imported project
                  </button>
                  <button type="button" className="button button-text" onClick={() => setPendingImport(null)}>
                    Cancel import
                  </button>
                </div>
              )}
              <button type="button" className="button button-text erase-button" onClick={eraseAndRestart}>
                Erase local project
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span className="wordmark">story<span className="wordmark-accent">partner</span></span>
        <p>A small tool for staying with your own story. MIT covers the project, not the writing you bring to it.</p>
      </footer>
    </div>
  );
}
