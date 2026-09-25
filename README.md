# StoryPartner

**A small writing studio for the books you want to write yourself.**

A shelf of possible books can live in your head while the first paragraph refuses to arrive. You might know the turning point, the character's worry, even the last image of a scene, yet finding the words between those landmarks is hard. StoryPartner starts there: with a human-written outline, one short scene, and room to make one editorial choice at a time.

The writing desk keeps a suggestion *beside* the draft. You can leave it, accept it, or use it to find a line of your own. A rejection never edits the scene. An acceptance makes a new snapshot; an undo returns to the exact previous one. If you write a different line, the history names that as your rewrite while retaining the proposal that helped prompt it. The point is to stay in conversation with your work, not to measure how much text a machine can produce.

**A hypothetical moment:** Nessa reaches a causeway while the tide rises. The example scene says the water "swallowed" a stone. The offline edit offers "covered" instead. Perhaps that feels too plain; perhaps it reveals a better rhythm you would write yourself. Either way, the outline and the final sentence remain decisions for the writer. This scene and its outline were created for this demo, not taken from anyone's manuscript.

The first public version is deliberately small. It has a plain-text outline and scene, two deterministic editing lenses for **one exact example sentence**, an off-page proposal, and scene revisions that branch when you return to an earlier snapshot. Other selected text gets an honest "no fixture" response, not a made-up edit. You can add a style preference or continuity fact yourself, choose whether it is attached to future requests, switch it off, or delete it. The fixture shows attached notes but does not interpret them. There is no model provider, key, analytics, or manuscript API call in the app.

Your project lives in this browser's local storage. Export JSON to keep a private backup; import checks its structure before replacing the current project. Browser storage can be cleared or lost, so do not treat it as your only copy.

## Run the studio

Requires Node.js 20.19+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Run `npm test` for the decision and privacy checks, or `npm run build` for the production bundle. The [research and design notes](docs/research.md) explain the evidence, limitations, accessible timeline, and next steps.

The existing [MIT license](LICENSE) covers the repository's original code and example assets. Writing you enter into the app is **not** licensed under MIT by using it; keep private manuscripts and exported backups out of this public repository.
