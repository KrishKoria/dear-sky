/** A run of text, marked when the leak check pointed at it. */
export interface Segment {
  text: string;
  mark: boolean;
}

/**
 * Splits `text` into plain and marked runs, marking every occurrence of every `match`.
 * Overlapping matches keep the earlier one. The runs join back into exactly `text`.
 */
export function markSegments(text: string, matches: string[]): Segment[] {
  const ranges: [number, number][] = [];
  for (const match of matches) {
    if (!match) continue;
    for (let at = text.indexOf(match); at !== -1; at = text.indexOf(match, at + match.length)) {
      ranges.push([at, at + match.length]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

  const out: Segment[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start < at) continue;
    if (start > at) out.push({ text: text.slice(at, start), mark: false });
    out.push({ text: text.slice(start, end), mark: true });
    at = end;
  }
  if (at < text.length || out.length === 0) out.push({ text: text.slice(at), mark: false });
  return out;
}
