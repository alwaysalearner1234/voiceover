import type { PacingBeat, StylePreset, TimingEstimate, VoiceOption } from '../types/studio.ts';

export const VIDEO_SRC = '/assets/aistudio/trialfence_problem_hook_cinematic_ac16bbf4.mp4';
export const VIDEO_DURATION_SECONDS = 10.0;
export const TARGET_MIN_SECONDS = 9.2;
export const TARGET_MAX_SECONDS = 10.0;
export const DEFAULT_TARGET_WPM = 148;

export const DEFAULT_VOICE_STYLE_PROMPT =
  'Calm, authoritative tech-documentary narrator (deep, clear, studio-mic quality). Pacing: ~145–150 WPM so the full line finishes cleanly in 9.5–10 seconds. Tone: Serious, measured, slightly tense on the final phrase—no upbeat or salesy inflection.';

export const DEFAULT_SCRIPT =
  'In multi-site clinical trials, stopping one person from enrolling twice at different sites... usually means sharing sensitive IDs— but keeping them private lets duplicate enrollments slip through.';

export const DEFAULT_PACING_BEATS: PacingBeat[] = [
  {
    id: 'beat-1',
    label: '0:00–0:03',
    startSeconds: 0.0,
    endSeconds: 3.0,
    text: 'In multi-site clinical trials, stopping one person from enrolling twice at different sites',
    directionNote: 'Measured documentary setup across the Site A / Site B split reception desks.',
  },
  {
    id: 'beat-2',
    label: '0:03–0:06',
    startSeconds: 3.0,
    endSeconds: 6.0,
    text: '...usually means sharing sensitive IDs—',
    directionNote: 'Brief half-second pause at the dash as the ID beam hits the PII Exposure Risk barrier.',
  },
  {
    id: 'beat-3',
    label: '0:06–0:10',
    startSeconds: 6.0,
    endSeconds: 10.0,
    text: '...but keeping them private lets duplicate enrollments slip through.',
    directionNote: 'Slightly tense, deliberate cadence on the final phrase as 2x Duplicate alerts appear.',
  },
];

export const PREBUILT_VOICES: VoiceOption[] = [
  { id: 'Charon', label: 'Charon', character: 'Deep, calm documentary baritone' },
  { id: 'Fenrir', label: 'Fenrir', character: 'Grave, authoritative broadcast weight' },
  { id: 'Puck', label: 'Puck', character: 'Crisp, articulate studio clarity' },
  { id: 'Kore', label: 'Kore', character: 'Balanced, composed clinical precision' },
  { id: 'Zephyr', label: 'Zephyr', character: 'Warm, steady neutral narration' },
];

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'trialfence-doc',
    label: 'Documentary Hook (Brief)',
    prompt: DEFAULT_VOICE_STYLE_PROMPT,
  },
  {
    id: 'clinical-investigative',
    label: 'Investigative Brief',
    prompt:
      'Low, composed investigative narrator with close studio-mic presence. Pacing: ~145 WPM, crisp articulation on "sensitive IDs", slight downward inflection and tension on "duplicate enrollments slip through." No sales tone.',
  },
  {
    id: 'executive-calm',
    label: 'Measured Keynote',
    prompt:
      'Calm, authoritative technical founder voiceover. Clean studio acoustics, ~148 WPM, deliberate half-second beat at the em-dash before delivering the privacy dilemma cleanly within 10 seconds.',
  },
];

export function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean).length;
}

export function countPauseHints(text: string): number {
  const ellipsisMatches = text.match(/\.{3}|…/g) ?? [];
  const dashMatches = text.match(/—|--/g) ?? [];
  return ellipsisMatches.length + dashMatches.length;
}

export function estimateNarrationDuration(
  text: string,
  targetWpm: number = DEFAULT_TARGET_WPM,
  videoDurationSeconds: number = VIDEO_DURATION_SECONDS,
): TimingEstimate {
  const safeWpm = Math.max(80, Math.min(240, targetWpm));
  const wordCount = countWords(text);
  const pauseCount = countPauseHints(text);

  if (wordCount === 0) {
    return {
      wordCount: 0,
      pauseCount: 0,
      speechSeconds: 0,
      pauseSeconds: 0,
      totalSeconds: 0,
      deltaFromTarget: -videoDurationSeconds,
      fitStatus: 'short',
      fitLabel: 'Empty script',
    };
  }

  // Broadcast documentary cadence compresses unstressed function words (~17% faster articulation)
  // while deliberate pause cues (— = ~0.45s, ... = ~0.25s) add measured dramatic beats.
  const ellipsisCount = (text.match(/\.{3}|…/g) ?? []).length;
  const dashCount = (text.match(/—|--/g) ?? []).length;
  const effectiveWpm = safeWpm * 1.22;
  const speechSeconds = (wordCount / effectiveWpm) * 60;
  const pauseSeconds = dashCount * 0.45 + ellipsisCount * 0.25;
  const totalSeconds = Number((speechSeconds + pauseSeconds).toFixed(2));
  const deltaFromTarget = Number((totalSeconds - videoDurationSeconds).toFixed(2));

  let fitStatus: TimingEstimate['fitStatus'] = 'optimal';
  let fitLabel = 'Fits 9.5–10.0s window';

  if (totalSeconds > videoDurationSeconds + 0.2) {
    fitStatus = 'overflow';
    fitLabel = `+${(totalSeconds - videoDurationSeconds).toFixed(1)}s over 10s frame`;
  } else if (totalSeconds > videoDurationSeconds - 0.05) {
    fitStatus = 'tight';
    fitLabel = 'Tight fit at 10.0s boundary';
  } else if (totalSeconds < 8.4) {
    fitStatus = 'short';
    fitLabel = `${(videoDurationSeconds - totalSeconds).toFixed(1)}s trailing silence`;
  }

  return {
    wordCount,
    pauseCount,
    speechSeconds: Number(speechSeconds.toFixed(2)),
    pauseSeconds: Number(pauseSeconds.toFixed(2)),
    totalSeconds,
    deltaFromTarget,
    fitStatus,
    fitLabel,
  };
}

export function getActiveBeatIndex(currentTime: number, beats: PacingBeat[]): number {
  if (beats.length === 0) return -1;
  const clamped = Math.max(0, currentTime);
  for (let i = 0; i < beats.length; i += 1) {
    const beat = beats[i];
    const isLast = i === beats.length - 1;
    if (clamped >= beat.startSeconds && (isLast ? clamped <= beat.endSeconds + 0.25 : clamped < beat.endSeconds)) {
      return i;
    }
  }
  return beats.length - 1;
}

export function formatTimecode(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  const wholeSecs = Math.floor(secs);
  const hundredths = Math.round((secs - wholeSecs) * 100) % 100;
  return `${mins}:${String(wholeSecs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export function buildCopyBriefText(
  stylePrompt: string,
  script: string,
  beats: PacingBeat[],
  targetWpm: number,
): string {
  const pacingLines = beats
    .map((beat) => `${beat.label}: "${beat.text}" (${beat.directionNote})`)
    .join('\n');

  return [
    'Voice Style Prompt (for AI Voice Tools)',
    stylePrompt.trim(),
    '',
    `Target Pacing: ~${targetWpm} WPM`,
    '',
    'Copy-Paste Script',
    `"${script.trim()}"`,
    '',
    'Quick Pacing Guide',
    pacingLines,
  ].join('\n');
}
