import { tick } from 'svelte';

/**
 * Keeps keyboard focus from falling back to the page when the button it was on goes inert: "done"
 * gives way to the choices, the tag gives way to the risen lantern. Without this, the keyboard
 * and screen readers lose their place. Focus that was inside the attached element moves to the
 * first match of `next` there. Focus anywhere else (the letter, the sound toggle) is left alone.
 *
 * Attach it with `{@attach carrier.attach}`, then call `settle()` whenever what's shown changes.
 */
export function focusCarrier(next: string) {
  let root: Element | undefined;
  let carrying = false;
  const onfocusin = (e: FocusEvent) => {
    carrying = !!root?.contains(e.target as Node);
  };

  return {
    attach(node: Element) {
      root = node;
      document.addEventListener('focusin', onfocusin);
      return () => {
        document.removeEventListener('focusin', onfocusin);
        root = undefined;
      };
    },

    async settle() {
      await tick();
      const active = document.activeElement;
      // Chrome lets go of a button that just went inert only at its next frame, so until then it
      // still reads as focused.
      const lost = !active || active === document.body || !!active.closest('[inert]');
      if (carrying && lost) root?.querySelector<HTMLElement>(next)?.focus({ preventScroll: true });
    },
  };
}
