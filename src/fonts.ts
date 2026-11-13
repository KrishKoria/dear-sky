// The three self-hosted faces (D43, the "storybook" pairing): one family for the letter and the
// interface, and a neat hand for the margin. Imported by every page entry.
import "@fontsource-variable/alegreya/wght.css";
import "@fontsource-variable/alegreya/wght-italic.css";
import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";
import "@fontsource/kalam/400.css";

/** What a page waits for (briefly) before it shows text, so nothing swaps face mid-shot. */
export const FONTS = [
  '400 19px "Alegreya Variable"',
  'italic 400 24px "Alegreya Variable"',
  '400 16px "Alegreya Sans"',
  '400 16px "Kalam"',
];
export const HAND_FONT = '400 16px "Kalam"';
