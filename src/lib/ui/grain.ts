/**
 * Paper grain, drawn once into a small bitmap tile and used as a CSS background (`--grain`).
 * A bitmap is cached by the browser, so typing never re-runs a noise filter the way an SVG
 * `feTurbulence` background would. Seeded, so the paper looks the same on every visit.
 */
import { seeded } from './random';

const SIZE = 220;

export function installGrain(): void {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rand = seeded(7);

  // Fine speckle: a warm brown at very low alpha.
  const image = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = rand();
    image.data[i] = 120;
    image.data[i + 1] = 92;
    image.data[i + 2] = 60;
    image.data[i + 3] = v > 0.5 ? Math.round((v - 0.5) * 34) : 0;
  }
  ctx.putImageData(image, 0, 0);

  // Fibres: short, faint, slightly curved strands, as in cotton paper.
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const angle = rand() * Math.PI * 2;
    const length = 5 + rand() * 13;
    ctx.strokeStyle = `rgba(${rand() > 0.5 ? '140, 110, 70' : '255, 252, 240'}, ${0.07 + rand() * 0.08})`;
    ctx.lineWidth = 0.5 + rand() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(angle + 0.6) * length * 0.5,
      y + Math.sin(angle + 0.6) * length * 0.5,
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length,
    );
    ctx.stroke();
  }

  document.documentElement.style.setProperty('--grain', `url(${canvas.toDataURL('image/png')})`);
}
