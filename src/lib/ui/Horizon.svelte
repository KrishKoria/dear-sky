<!--
  The town at the bottom of the sky: three dim layers of
  rounded rooftops, one warm attic window and a curl of chimney smoke. Never mountains.
  Drawn wide and cropped from the centre, so the lit window stays in view on phones.
-->
<script lang="ts">
  type Roof = 'gable' | 'dome';
  interface House {
    x: number;
    w: number;
    wall: number;
    peak: number;
    roof: Roof;
  }

  /** One closed outline per house; overlapping outlines fill as one silhouette. */
  function house({ x, w, wall, peak, roof }: House, ground: number): string {
    const right = x + w;
    if (roof === 'dome') {
      return `M${x} ${ground}V${wall}A${w / 2} ${wall - peak} 0 0 1 ${right} ${wall}V${ground}Z`;
    }
    // A gable with a softly rounded ridge.
    const mid = x + w / 2;
    const slope = (wall - peak) / (w / 2);
    const k = Math.min(9, w / 6);
    return `M${x} ${ground}V${wall}L${mid - k} ${peak + k * slope}Q${mid} ${peak} ${mid + k} ${peak + k * slope}L${right} ${wall}V${ground}Z`;
  }

  function layer(houses: House[], ground: number): string {
    return houses.map((h) => house(h, ground)).join('') + `M-60 ${ground}H1660V200H-60Z`;
  }

  const far = layer(
    [
      { x: -20, w: 130, wall: 118, peak: 86, roof: 'gable' },
      { x: 96, w: 92, wall: 112, peak: 88, roof: 'dome' },
      { x: 200, w: 150, wall: 120, peak: 90, roof: 'gable' },
      { x: 340, w: 76, wall: 110, peak: 82, roof: 'gable' },
      { x: 420, w: 124, wall: 116, peak: 84, roof: 'dome' },
      { x: 556, w: 160, wall: 122, peak: 92, roof: 'gable' },
      { x: 702, w: 92, wall: 110, peak: 84, roof: 'gable' },
      { x: 800, w: 140, wall: 118, peak: 90, roof: 'dome' },
      { x: 948, w: 112, wall: 114, peak: 88, roof: 'gable' },
      { x: 1180, w: 96, wall: 112, peak: 86, roof: 'dome' },
      { x: 1290, w: 150, wall: 118, peak: 88, roof: 'gable' },
      { x: 1446, w: 180, wall: 114, peak: 84, roof: 'gable' },
    ],
    150,
  );

  const mid = layer(
    [
      { x: -30, w: 170, wall: 132, peak: 106, roof: 'gable' },
      { x: 150, w: 110, wall: 128, peak: 104, roof: 'dome' },
      { x: 270, w: 180, wall: 134, peak: 102, roof: 'gable' },
      { x: 470, w: 120, wall: 130, peak: 108, roof: 'gable' },
      { x: 600, w: 200, wall: 136, peak: 110, roof: 'dome' },
      { x: 830, w: 150, wall: 132, peak: 106, roof: 'gable' },
      { x: 1000, w: 170, wall: 128, peak: 92, roof: 'gable' }, // the house with the lit window
      { x: 1185, w: 120, wall: 134, peak: 110, roof: 'dome' },
      { x: 1320, w: 160, wall: 130, peak: 102, roof: 'gable' },
      { x: 1490, w: 150, wall: 134, peak: 108, roof: 'gable' },
    ],
    158,
  );

  const near = layer(
    [
      { x: -40, w: 220, wall: 150, peak: 128, roof: 'dome' },
      { x: 190, w: 160, wall: 148, peak: 126, roof: 'gable' },
      { x: 380, w: 240, wall: 152, peak: 134, roof: 'dome' },
      { x: 650, w: 180, wall: 150, peak: 128, roof: 'gable' },
      { x: 860, w: 250, wall: 154, peak: 138, roof: 'dome' },
      { x: 1160, w: 170, wall: 148, peak: 124, roof: 'gable' },
      { x: 1360, w: 280, wall: 152, peak: 132, roof: 'dome' },
    ],
    165,
  );
</script>

<svg class="horizon" viewBox="0 0 1600 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <radialGradient id="window-glow">
      <stop offset="0" stop-color="var(--window-glow)" />
      <stop offset="1" stop-color="var(--window-glow)" stop-opacity="0" />
    </radialGradient>
  </defs>

  <path d={far} fill="var(--roof-far)" />
  <path d={mid} fill="var(--roof-mid)" />

  <!-- Chimney, then its smoke, on the lit house -->
  <path d="M1109 108V84q0-2.5 2.5-2.5h9q2.5 0 2.5 2.5v24z" fill="var(--roof-mid)" />
  <g class="smoke" fill="none" stroke="var(--smoke)" stroke-width="2.4" stroke-linecap="round">
    <path class="puff" d="M1116 76c-6-7 5-12 0-19s3-11 1-16" />
    <path class="puff late" d="M1116 76c-6-7 5-12 0-19s3-11 1-16" />
  </g>

  <!-- The one warm attic window -->
  <circle cx="1085" cy="114" r="34" fill="url(#window-glow)" />
  <path d="M1077 124v-11a8 8 0 0 1 16 0v11z" fill="var(--window)" />
  <path d="M1085 105.5v18.5M1077.5 115.5h15" stroke="var(--roof-mid)" stroke-width="1.6" />

  <path d={near} fill="var(--roof-near)" />
</svg>

<style>
  .horizon {
    position: fixed;
    inset: auto 0 0 0;
    width: 100%;
    height: var(--horizon-h);
    display: block;
    pointer-events: none;
  }

  .puff {
    opacity: 0;
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: rise 7s var(--ease-out) infinite;
  }

  .puff.late {
    animation-delay: -3.5s;
  }

  @keyframes rise {
    0% {
      opacity: 0;
      transform: translateY(4px) scale(0.85);
    }
    25% {
      opacity: 0.85;
    }
    100% {
      opacity: 0;
      transform: translateY(-16px) scale(1.15);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .puff {
      animation: none;
      opacity: 0.5;
    }
    .puff.late {
      display: none;
    }
  }
</style>
