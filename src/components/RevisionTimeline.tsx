export default function RevisionTimeline() {
  return (
    <figure className="timeline-figure">
      <svg
        viewBox="0 0 960 370"
        role="img"
        aria-labelledby="timeline-title"
        aria-describedby="timeline-description"
        className="timeline-art"
      >
        <title id="timeline-title">An illustrative, writer-led revision path</title>
        <desc id="timeline-description">
          A solid path goes from an outline written by the writer to a scene written by the
          writer, then to a writer-approved second scene. Two dashed AI proposal branches
          leave the first scene. Suggestion A is rejected and ends. Suggestion B is rewritten
          by the writer before joining the second scene.
        </desc>
        <defs>
          <marker id="timeline-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#57746a" />
          </marker>
          <marker id="proposal-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#b17958" />
          </marker>
        </defs>

        <path className="timeline-writer-path" d="M 249 110 H 349" markerEnd="url(#timeline-arrow)" />
        <path className="timeline-writer-path" d="M 571 110 H 711" markerEnd="url(#timeline-arrow)" />
        <path className="timeline-proposal-path" d="M 435 159 C 435 194 448 202 448 250" markerEnd="url(#proposal-arrow)" />
        <path className="timeline-proposal-path" d="M 494 159 C 540 221 774 186 774 250" markerEnd="url(#proposal-arrow)" />
        <path className="timeline-writer-path" d="M 878 250 V 160" markerEnd="url(#timeline-arrow)" />

        <g className="timeline-node">
          <rect x="28" y="62" width="220" height="96" rx="17" />
          <text x="49" y="97" className="timeline-node-title">Outline v1</text>
          <text x="49" y="127" className="timeline-node-meta">written by writer</text>
        </g>
        <g className="timeline-node">
          <rect x="350" y="62" width="220" height="96" rx="17" />
          <text x="371" y="97" className="timeline-node-title">Scene v1</text>
          <text x="371" y="127" className="timeline-node-meta">written by writer</text>
        </g>
        <g className="timeline-node timeline-node-final">
          <rect x="712" y="62" width="220" height="96" rx="17" />
          <text x="733" y="97" className="timeline-node-title">Scene v2</text>
          <text x="733" y="127" className="timeline-node-meta">writer-approved</text>
        </g>
        <g className="timeline-node timeline-node-proposal">
          <rect x="350" y="251" width="220" height="96" rx="17" />
          <text x="371" y="286" className="timeline-node-title">Suggestion A</text>
          <text x="371" y="316" className="timeline-node-meta">AI · rejected; no edit</text>
        </g>
        <g className="timeline-node timeline-node-proposal">
          <rect x="712" y="251" width="220" height="96" rx="17" />
          <text x="733" y="286" className="timeline-node-title">Suggestion B</text>
          <text x="733" y="316" className="timeline-node-meta">AI · rewritten by writer</text>
        </g>
      </svg>
      <figcaption>
        An illustrative path: solid lines are writer actions; dashed lines are proposals.
        A rejected branch never changes the scene.
      </figcaption>
      <ol className="timeline-steps">
        <li>The writer outlines the story, then drafts scene v1.</li>
        <li>Suggestion A branches from scene v1 and is rejected; the scene stays as it was.</li>
        <li>Suggestion B also branches from scene v1. The writer changes its wording.</li>
        <li>Only that writer-approved rewrite joins scene v2.</li>
      </ol>
    </figure>
  );
}
