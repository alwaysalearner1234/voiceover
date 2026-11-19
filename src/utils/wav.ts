export interface ParsedWav {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  pcm: Buffer;
  durationSeconds: number;
}

export interface BeatClipInput {
  buffer: Buffer;
  startSeconds: number;
  endSeconds: number;
}

export interface AssembledWavResult {
  wavBuffer: Buffer;
  durationSeconds: number;
  sampleRate: number;
  clipDurations: number[];
  clippedCount: number;
}

export function parseWav(buffer: Buffer): ParsedWav {
  if (buffer.length < 44) {
    throw new Error('Invalid WAV buffer: shorter than 44-byte RIFF header.');
  }
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Invalid WAV buffer: missing RIFF/WAVE signature.');
  }

  let offset = 12;
  let sampleRate = 24000;
  let channels = 1;
  let bitsPerSample = 16;
  let dataStart = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;

    if (chunkId === 'fmt ' && bodyStart + 16 <= buffer.length) {
      channels = buffer.readUInt16LE(bodyStart + 2);
      sampleRate = buffer.readUInt32LE(bodyStart + 4);
      bitsPerSample = buffer.readUInt16LE(bodyStart + 14);
    } else if (chunkId === 'data') {
      dataStart = bodyStart;
      dataSize = Math.min(chunkSize, buffer.length - bodyStart);
      break;
    }

    offset = bodyStart + chunkSize + (chunkSize % 2);
  }

  if (dataStart < 0) {
    throw new Error('Invalid WAV buffer: missing data chunk.');
  }

  const pcm = buffer.subarray(dataStart, dataStart + dataSize);
  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
  const durationSeconds = bytesPerSecond > 0 ? Number((pcm.length / bytesPerSecond).toFixed(3)) : 0;

  return {
    sampleRate,
    channels,
    bitsPerSample,
    pcm,
    durationSeconds,
  };
}

export function encodeWav(
  pcm: Buffer,
  sampleRate: number = 24000,
  channels: number = 1,
  bitsPerSample: number = 16,
): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export function trimSilenceEdges(
  pcm: Buffer,
  sampleRate: number,
  bytesPerSample: number = 2,
  threshold: number = 180,
): Buffer {
  if (bytesPerSample !== 2 || pcm.length < 4) return pcm;
  const totalSamples = Math.floor(pcm.length / 2);
  let firstActive = 0;
  let lastActive = totalSamples - 1;

  while (firstActive < totalSamples) {
    const sample = Math.abs(pcm.readInt16LE(firstActive * 2));
    if (sample >= threshold) break;
    firstActive += 1;
  }

  while (lastActive > firstActive) {
    const sample = Math.abs(pcm.readInt16LE(lastActive * 2));
    if (sample >= threshold) break;
    lastActive -= 1;
  }

  // Keep a small 40ms breath margin so words are never clipped abruptly
  const padSamples = Math.floor(sampleRate * 0.04);
  const startSample = Math.max(0, firstActive - padSamples);
  const endSample = Math.min(totalSamples, lastActive + 1 + padSamples);

  if (endSample <= startSample) return pcm;
  return pcm.subarray(startSample * 2, endSample * 2);
}

export function assembleBeatLockedWav(
  clips: BeatClipInput[],
  totalDurationSeconds: number = 10.0,
): AssembledWavResult {
  if (clips.length === 0) {
    throw new Error('At least one audio clip is required for beat-locked assembly.');
  }

  const parsedClips = clips.map((clip) => ({
    ...clip,
    parsed: parseWav(clip.buffer),
  }));

  const sampleRate = parsedClips[0].parsed.sampleRate;
  const channels = parsedClips[0].parsed.channels;
  const bitsPerSample = parsedClips[0].parsed.bitsPerSample;
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerSecond = sampleRate * channels * bytesPerSample;

  let requiredEndSeconds = totalDurationSeconds;
  const trimmedPcms: Buffer[] = [];
  const clipDurations: number[] = [];
  let clippedCount = 0;

  for (const item of parsedClips) {
    const trimmed = trimSilenceEdges(item.parsed.pcm, sampleRate, bytesPerSample);
    trimmedPcms.push(trimmed);
    const dur = bytesPerSecond > 0 ? trimmed.length / bytesPerSecond : 0;
    clipDurations.push(Number(dur.toFixed(2)));
    const slotBudget = Math.max(0.2, item.endSeconds - item.startSeconds);
    if (dur > slotBudget + 0.05) {
      clippedCount += 1;
    }
    requiredEndSeconds = Math.max(requiredEndSeconds, item.startSeconds + dur);
  }

  const totalSamples = Math.ceil(requiredEndSeconds * sampleRate * channels);
  const outPcm = Buffer.alloc(totalSamples * bytesPerSample);

  // Mix clips into their exact cue timestamps cleanly (16-bit saturating add)
  for (let idx = 0; idx < parsedClips.length; idx += 1) {
    const startSample = Math.max(0, Math.round(parsedClips[idx].startSeconds * sampleRate * channels));
    const src = trimmedPcms[idx];
    const srcSamples = Math.floor(src.length / 2);

    for (let s = 0; s < srcSamples; s += 1) {
      const destIndex = startSample + s;
      if (destIndex >= totalSamples) break;
      const existing = outPcm.readInt16LE(destIndex * 2);
      const incoming = src.readInt16LE(s * 2);
      const mixed = Math.max(-32768, Math.min(32767, existing + incoming));
      outPcm.writeInt16LE(mixed, destIndex * 2);
    }
  }

  const wavBuffer = encodeWav(outPcm, sampleRate, channels, bitsPerSample);
  const durationSeconds = Number((outPcm.length / bytesPerSecond).toFixed(2));

  return {
    wavBuffer,
    durationSeconds,
    sampleRate,
    clipDurations,
    clippedCount,
  };
}

export function computeWavPeaks(wavBuffer: Buffer, bucketCount: number = 96): {
  peaks: number[];
  durationSeconds: number;
  sampleRate: number;
} {
  const parsed = parseWav(wavBuffer);
  const sampleCount = Math.floor(parsed.pcm.length / 2);
  const buckets = Math.max(16, Math.min(256, bucketCount));
  const peaks: number[] = new Array(buckets).fill(0);

  if (sampleCount === 0) {
    return { peaks, durationSeconds: parsed.durationSeconds, sampleRate: parsed.sampleRate };
  }

  const samplesPerBucket = Math.max(1, Math.floor(sampleCount / buckets));
  let globalMax = 0;

  for (let b = 0; b < buckets; b += 1) {
    const start = b * samplesPerBucket;
    const end = b === buckets - 1 ? sampleCount : Math.min(sampleCount, start + samplesPerBucket);
    let maxAmp = 0;
    for (let s = start; s < end; s += 1) {
      const amp = Math.abs(parsed.pcm.readInt16LE(s * 2)) / 32768;
      if (amp > maxAmp) maxAmp = amp;
    }
    peaks[b] = maxAmp;
    if (maxAmp > globalMax) globalMax = maxAmp;
  }

  const norm = globalMax > 0.05 ? globalMax : 1;
  return {
    peaks: peaks.map((val) => Number((val / norm).toFixed(3))),
    durationSeconds: parsed.durationSeconds,
    sampleRate: parsed.sampleRate,
  };
}
