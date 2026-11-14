import { expect, test } from 'bun:test';
import { Camera } from '../src/lib/ui/glide';

/** Runs the camera at 60 fps until it rests (or gives up). Returns the frames it took. */
function settle(cam: Camera, max = 600): number {
  for (let i = 0; i < max; i++) if (!cam.step(16.7)) return i;
  return max;
}

const camera = (min = -1000, max = 1000) => {
  const cam = new Camera(240);
  cam.setBounds(min, max);
  return cam;
};

test('a drag follows the finger: right moves the sky right, so the camera looks left', () => {
  const cam = camera();
  cam.grab();
  cam.drag(120);
  expect(cam.x).toBe(-120);
  cam.drag(-20);
  expect(cam.x).toBe(-100);
});

test('a flick coasts on past where the finger let go, slowing to rest', () => {
  const cam = camera();
  cam.grab();
  cam.drag(-100);
  cam.release(-1.2); // finger moving left at 1.2 px/ms
  const frames = settle(cam);
  expect(frames).toBeLessThan(600);
  expect(cam.x).toBeGreaterThan(400);
  expect(cam.moving).toBe(false);
});

test('past an edge the sky stretches less than the finger, never more than its give', () => {
  const cam = camera(0, 500);
  cam.grab();
  cam.drag(300); // 300 px past the left edge
  expect(cam.x).toBeLessThan(0);
  expect(cam.x).toBeGreaterThan(-300);
  cam.drag(5000);
  expect(cam.x).toBeGreaterThan(-240);
});

test('let go past an edge, it settles back onto the edge', () => {
  const cam = camera(0, 500);
  cam.grab();
  cam.drag(-900);
  cam.release(0);
  settle(cam);
  expect(cam.x).toBe(500);
});

test('a hard flick toward an edge stops at the edge', () => {
  const cam = camera(0, 500);
  cam.grab();
  cam.release(-3);
  settle(cam);
  expect(cam.x).toBe(500);
});

test('grabbing again picks up the stretch where it is, without a jump', () => {
  const cam = camera(0, 500);
  cam.grab();
  cam.drag(200);
  const stretched = cam.x;
  cam.release(0);
  cam.grab();
  cam.drag(0);
  expect(cam.x).toBeCloseTo(stretched, 6);
});

test('a tap during a fast coast catches it; a tap at rest does not', () => {
  const cam = camera();
  cam.grab();
  cam.release(-2);
  cam.step(16.7);
  expect(cam.grab()).toBe(true);
  cam.release(0);
  settle(cam);
  expect(cam.grab()).toBe(false);
});

test('wheel pushes add up and ease to their target, inside the edges', () => {
  const cam = camera(0, 500);
  cam.push(100, 90);
  cam.push(100, 90);
  settle(cam);
  expect(cam.x).toBe(200);
  cam.push(9000);
  settle(cam);
  expect(cam.x).toBe(500);
});

test('the wind only moves a resting sky, and never past an edge', () => {
  const cam = camera(0, 10);
  cam.nudge(4);
  expect(cam.x).toBe(4);
  cam.nudge(100);
  expect(cam.x).toBe(10);
  cam.grab();
  cam.nudge(-5);
  expect(cam.x).toBe(10);
});

test('new edges pull a resting sky back inside', () => {
  const cam = camera(0, 1000);
  cam.easeTo(900);
  settle(cam);
  cam.setBounds(0, 400);
  expect(cam.moving).toBe(true);
  settle(cam);
  expect(cam.x).toBe(400);
});
