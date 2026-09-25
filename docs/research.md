# Research and design notes

StoryPartner is a small test of **writer-directed editing**, not a system for generating a novel. These primary sources informed its boundaries; their populations and tasks differ, so none proves that this starter preserves a person's voice.

| Primary source | What we take from it |
| --- | --- |
| [Calderwood et al., *How Novelists Use Generative Language Models* (IUI 2020 workshop)](https://www.cs.columbia.edu/~chilton/web/my_publications/Calderwood_How_Novelists_Use_Generative_Language_Models.pdf) | Four professional novelists explored optional, editable suggestions. A small exploratory sample, useful for thinking about reviewability rather than broad claims about writers. |
| [Lee et al., *CoAuthor* (CHI 2022)](https://doi.org/10.1145/3491102.3502030) | Its interaction records distinguish requesting, selecting, dismissing, and editing a suggestion. This starter records only local proposal, decision, and revision events—not keystrokes. |
| [Ippolito et al., *Creative Writing with an AI-Powered Writing Assistant* (Wordcraft, 2022 preprint)](https://arxiv.org/pdf/2211.05030) | Published writers found brainstorming uses but struggled with distinctive voice and deeper context. We offer a small, contestable edit rather than promising stylistic fidelity. |
| [Mirowski et al., *Co-Writing Screenplays and Theatre Scripts with Language Models* (Dramatron, CHI 2023)](https://doi.org/10.1145/3544548.3581225) | Visible story structure and points for human intervention are useful ideas; a screenplay study does not justify automatically drafting a book. |
| [Dhillon et al., *Shaping Human-AI Collaboration* (CHI 2024)](https://doi.org/10.1145/3613904.3642134) | In argumentative writing, output quality and productivity can improve while ownership and satisfaction decline. Control matters alongside prose quality, and fiction may differ. |
| [Yeh et al., *GhostWriter* (arXiv design-probe preprint)](https://arxiv.org/pdf/2402.08855) | Inspectable style controls motivate a note ledger. We do not extract preferences from a manuscript without the author's explicit action. |

## Why this editor is small

The first implementation uses a plain-text `<textarea>` and full, immutable scene snapshots. A proposal stores its exact selected span, source revision, and monotonic scene epoch. Acceptance or rewriting requires all three to match the current saved text; after a save, undo, or restore, an older proposal cannot silently apply even if the text looks identical again. Undo moves to a parent snapshot; a later edit can create another branch. Rejection creates a decision record but does not touch the scene. The outline and unsaved scene draft persist locally, while **only saved scene revisions** have snapshot history.

[Tiptap's React guide](https://tiptap.dev/docs/editor/getting-started/install/react) is a good path to richer documents later. [ProseMirror's tracking example](https://prosemirror.net/examples/track/) shows how commits and reversions can work, but also cautions that rebased reversions over intervening edits can be surprising. Before adopting rich-text spans, we would need explicit conflict handling and tests for version mapping. Plain-text offsets and snapshots keep this first revision guarantee inspectable.

The fixture offers two variants for one original sentence, chosen by the writer's editing lens. It does not generate replacements for arbitrary selections and it does not interpret free-form notes. Enabled preference and continuity notes are attached by ID to a request so the writer can see what was in scope; disabled notes are omitted. Deleting a note removes its text and those ID references from saved proposals. A writer rewrite is attributed to the writer **with** a link to the offline suggestion, rather than counted as wholly model-authored or wholly uninfluenced.

## Privacy, rights, and accessible history

The app contains no provider integration, telemetry, external fonts, or code that sends manuscript text to a model. The browser loads the app's assets from the local Vite server; installing dependencies requires the usual package-registry access. Manuscript, history, and notes are stored under this browser origin's `localStorage` key, not encrypted or automatically backed up. The app disables textarea spellcheck, but browser extensions, operating-system input services, shared devices, and browser-managed storage are outside its control. Export creates a JSON file containing the full project; import validates its shape and waits for an explicit Replace action. Erasing removes the local key, not an exported file or another device's copy.

The repository's existing MIT license applies to its original code and sample assets, **not** to an author's manuscript entered in the browser. No third-party prose or personal draft is included. The [U.S. Copyright Office's AI copyrightability report](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf) discusses human expressive contribution case by case. A revision log documents choices; it is not a legal authorship or copyright ruling.

The app includes an original **static** branching timeline: an SVG with a named `<title>`, `<desc>`, textual node labels, solid writer paths and dashed proposal paths. Its adjacent visible caption and ordered list explain the same fork, including the rejected branch that does not rejoin. This follows [W3C WAI guidance on long descriptions of complex images](https://www.w3.org/WAI/tutorials/images/complex/). The diagram has no hover or click behavior to hide from keyboard users; actual accept, reject, rewrite, undo, and restore actions use native buttons.

## Next, if writers want it

An optional provider would need a per-request preview of the **exact excerpt, enabled notes, destination, and retention terms**, followed by affirmative consent before transmission; keys would stay out of client code. Future work could add more scenes, author-confirmed continuity questions, richer editing with explicit span conflicts, and usability sessions with consenting writers. Evaluation should ask about unintended edits, reversibility, perceived agency, and false continuity alarms—not optimize an acceptance rate or claim measured voice preservation from this demo.
