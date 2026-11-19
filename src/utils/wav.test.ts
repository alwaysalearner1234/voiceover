import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleBeatLockedWav, computeWavPeaks, encodeWav, parseWav } from './wav';

function makeToneWav(durationSeconds: number, amplitude: number = 12000, sampleRate: number = 24000): Buffer {
  const samples = Math.floor(durationSeconds * sampleRate);
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    const val = Math.round(Math.sin((i / sampleRate) * 440 * Math.PI * 2) * amplitude);
    pcm.writeInt16LE(val, i * 2);
  }
  return encodeWav(pcm, sampleRate, 1, 16);
}

test('encodeWav and parseWav round-trip sample metadata and duration', () => {
  const wav = makeToneWav(1.5, 8000, 24000);
  const parsed = parseWav(wav);
  assert.equal(parsed.sampleRate, 24000);
  assert.equal(parsed.channels, 1);
  assert.equal(parsed.bitsPerSample, 16);
  assert.equal(parsed.durationSeconds, 1.5);
});

test('assembleBeatLockedWav aligns 3 beat clips inside a 10.0s timeline', () => {
  const clip1 = makeToneWav(2.4);
  const clip2 = makeToneWav(2.1);
  const clip3 = makeToneWav(3.2);

  const result = assembleBeatLockedWav(
    [
      { buffer: clip1, startSeconds: 0.0, endSeconds: 3.0 },
      { buffer: clip2, startSeconds: 3.0, endSeconds: 6.0 },
      { buffer: clip3, startSeconds: 6.0, endSeconds: 10.0 },
    ],
    10.0,
  );

  assert.equal(result.durationSeconds, 10);
  assert.equal(result.clippedCount, 0);
  assert.equal(result.clipDurations.length, 3);

  const peaksInfo = computeWavPeaks(result.wavBuffer, 40);
  assert.equal(peaksInfo.peaks.length, 40);
  assert.ok(peaksInfo.peaks[2] > 0.5);
});

test('assembleBeatLockedWav flags overflow when a beat exceeds its allocated window', () => {
  const longClip1 = makeToneWav(3.8);
  const clip2 = makeToneWav(2.0);
  const result = assembleBeatLockedWav(
    [
      { buffer: longClip1, startSeconds: 0.0, endSeconds: 3.0 },
      { buffer: clip2, startSeconds: 3.0, endSeconds: 6.0 },
    ],
    10.0,
  );
  assert.equal(result.clippedCount, 1);
});
