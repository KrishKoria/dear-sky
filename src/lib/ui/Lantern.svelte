<!--
  A paper lantern (design/directions.md §4 rule 3): a bell body with ribs, a dark cap and base,
  and an inner glow. One warm tone per lantern; variety comes from shape, not hue.
-->
<script lang="ts">
  type Tone = 'honey' | 'apricot' | 'rose';
  let { tone = 'honey', size = 18 }: { tone?: Tone; size?: number } = $props();
  const id = $props.id();
</script>

<svg
  class="lantern"
  width={size}
  height={size * 1.4}
  viewBox="0 0 40 56"
  aria-hidden="true"
  style:--tone="var(--lantern-{tone})"
>
  <defs>
    <radialGradient id="{id}-glow" cx="50%" cy="58%" r="55%">
      <stop offset="0" stop-color="var(--flame-core)" stop-opacity="0.95" />
      <stop offset="0.55" stop-color="var(--tone)" stop-opacity="0.2" />
      <stop offset="1" stop-color="var(--tone)" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect x="14" y="4" width="12" height="5.5" rx="2.2" fill="var(--lantern-cap)" />
  <path d="M14.5 9.5C6 14.5 4.5 30 8 40c2.2 5.6 6.4 8 12 8s9.8-2.4 12-8c3.5-10 2-25.5-6.5-30.5z" fill="var(--tone)" />
  <path d="M14.5 9.5C6 14.5 4.5 30 8 40c2.2 5.6 6.4 8 12 8s9.8-2.4 12-8c3.5-10 2-25.5-6.5-30.5z" fill="url(#{id}-glow)" />
  <g fill="none" stroke="var(--lantern-cap)" stroke-opacity="0.22" stroke-width="1.1" stroke-linecap="round">
    <path d="M17.5 10c-4.5 10-4.5 26-1.5 37.5" />
    <path d="M20 9.5v38.5" />
    <path d="M22.5 10c4.5 10 4.5 26 1.5 37.5" />
  </g>
  <rect x="15" y="47" width="10" height="4.5" rx="1.8" fill="var(--lantern-cap)" />
</svg>

<style>
  .lantern {
    display: block;
    overflow: visible;
  }
</style>
