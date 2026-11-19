import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PACING_BEATS,
  DEFAULT_SCRIPT,
  DEFAULT_TARGET_WPM,
  DEFAULT_VOICE_STYLE_PROMPT,
  buildCopyBriefText,
  countPauseHints,
  countWords,
  estimateNarrationDuration,
  formatTimecode,
  getActiveBeatIndex,
} from './timing';

test('counts words and pause cues accurately for default TrialFence script', () => {
  const words = countWords(DEFAULT_SCRIPT);
  const pauses = countPauseHints(DEFAULT_SCRIPT);
  assert.equal(words, 27);
  assert.equal(pauses, 2);
});

test('estimates default TrialFence script near 9.5–10.0s at 148 WPM', () => {
  const est = estimateNarrationDuration(DEFAULT_SCRIPT, DEFAULT_TARGET_WPM, 10.0);
  assert.equal(est.wordCount, 27);
  assert.equal(est.pauseCount, 2);
  assert.ok(est.totalSeconds >= 9.4 && est.totalSeconds <= 10.1, `Expected ~9.8s, got ${est.totalSeconds}`);
  assert.equal(est.fitStatus, 'optimal');
});

test('flags overflow and short scripts cleanly', () => {
  const longScript = `${DEFAULT_SCRIPT} ${DEFAULT_SCRIPT}`;
  const overflow = estimateNarrationDuration(longScript, 148, 10.0);
  assert.equal(overflow.fitStatus, 'overflow');

  const shortScript = 'Stopping duplicate enrollments.';
  const shortEst = estimateNarrationDuration(shortScript, 148, 10.0);
  assert.equal(shortEst.fitStatus, 'short');
});

test('resolves active pacing beat index from playhead seconds', () => {
  assert.equal(getActiveBeatIndex(0.0, DEFAULT_PACING_BEATS), 0);
  assert.equal(getActiveBeatIndex(2.95, DEFAULT_PACING_BEATS), 0);
  assert.equal(getActiveBeatIndex(3.0, DEFAULT_PACING_BEATS), 1);
  assert.equal(getActiveBeatIndex(5.8, DEFAULT_PACING_BEATS), 1);
  assert.equal(getActiveBeatIndex(6.0, DEFAULT_PACING_BEATS), 2);
  assert.equal(getActiveBeatIndex(10.0, DEFAULT_PACING_BEATS), 2);
});

test('formats SMPTE-style seconds timecodes cleanly', () => {
  assert.equal(formatTimecode(0), '0:00.00');
  assert.equal(formatTimecode(3.5), '0:03.50');
  assert.equal(formatTimecode(9.99), '0:09.99');
});

test('builds complete copy-paste brief text with style, script, and beats', () => {
  const brief = buildCopyBriefText(
    DEFAULT_VOICE_STYLE_PROMPT,
    DEFAULT_SCRIPT,
    DEFAULT_PACING_BEATS,
    148,
  );
  assert.ok(brief.includes('Calm, authoritative tech-documentary narrator'));
  assert.ok(brief.includes('0:00–0:03'));
  assert.ok(brief.includes('0:03–0:06'));
  assert.ok(brief.includes('0:06–0:10'));
});
