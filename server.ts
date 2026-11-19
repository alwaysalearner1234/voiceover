import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { assembleBeatLockedWav, computeWavPeaks } from './src/utils/wav.ts';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 3000);
const VIDEO_FILE_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/trialfence_problem_hook_cinematic_ac16bbf4.mp4',
);

const ALLOWED_MODELS = new Set(['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts']);
const ALLOWED_VOICES = new Set(['Charon', 'Fenrir', 'Puck', 'Kore', 'Zephyr']);

function getAiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractAudioBase64(response: GenerateContentResponse): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return part.inlineData.data;
    }
  }
  throw new Error('Gemini TTS returned no inline audio data.');
}

async function synthesizeSegmentWav(params: {
  model: string;
  voiceName: string;
  text: string;
  style: string;
}): Promise<Buffer> {
  const { model, voiceName, text, style } = params;

  const attempts: Array<{
    apiVersion?: string;
    useSpeechMetadata: boolean;
    useSpeechConfig: boolean;
  }> = [
    { apiVersion: undefined, useSpeechMetadata: true, useSpeechConfig: true },
    { apiVersion: 'v1alpha', useSpeechMetadata: true, useSpeechConfig: true },
    { apiVersion: 'v1beta', useSpeechMetadata: false, useSpeechConfig: true },
    { apiVersion: 'v1beta', useSpeechMetadata: false, useSpeechConfig: false },
  ];

  let lastError: unknown = null;

  for (const attempt of attempts) {
    const ai = getAiClient(attempt.apiVersion);
    const promptText =
      attempt.useSpeechMetadata || !style
        ? text
        : `Speak in this style: ${style}\n\nTranscript:\n${text}`;

    const part =
      attempt.useSpeechMetadata && style
        ? { text: promptText, speechMetadata: { style } }
        : { text: promptText };

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [part],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          ...(attempt.useSpeechConfig
            ? {
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
              }
            : {}),
        },
      });

      const base64Audio = extractAudioBase64(response);
      return Buffer.from(base64Audio, 'base64');
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isSchemaFieldMismatch =
        msg.includes('Unknown name') || msg.includes('INVALID_ARGUMENT') || msg.includes('Cannot find field');
      if (!isSchemaFieldMismatch) {
        throw err;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini TTS synthesis failed.');
}

function extractReadableMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      return String(parsed.error.message).replace(/\s+/g, ' ').trim();
    }
  } catch {
    // not JSON
  }
  return raw;
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const readable = extractReadableMessage(raw);
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return {
      status: 503,
      message: 'Gemini API key is not configured. Check the Settings > Secrets panel.',
    };
  }
  if (raw.includes('PERMISSION_DENIED') || raw.includes('403') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'Gemini API key was rejected (403/invalid). Verify your key in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Gemini API rate or quota limit reached (429). Please retry in a moment.',
    };
  }
  if (raw.includes('INVALID_ARGUMENT') || raw.includes('400')) {
    return {
      status: 400,
      message: readable,
    };
  }
  return {
    status: 500,
    message: readable || 'Unexpected error during Gemini TTS synthesis.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', async (_req, res) => {
    let ffmpegAvailable = false;
    try {
      await execFileAsync('ffmpeg', ['-version']);
      ffmpegAvailable = true;
    } catch {
      ffmpegAvailable = false;
    }

    res.json({
      ok: true,
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      ffmpegAvailable,
      videoExists: fs.existsSync(VIDEO_FILE_PATH),
    });
  });

  app.post('/api/tts/generate', async (req, res) => {
    try {
      const {
        mode = 'single',
        model = 'gemini-3.8-flash-lite-tts',
        voiceName = 'Charon',
        stylePrompt = '',
        script = '',
        beats = [],
      } = req.body ?? {};

      const safeModel = ALLOWED_MODELS.has(model) ? model : 'gemini-3.8-flash-lite-tts';
      const safeVoice = ALLOWED_VOICES.has(voiceName) ? voiceName : 'Charon';

      if (mode === 'beat-locked') {
        if (!Array.isArray(beats) || beats.length === 0) {
          res.status(400).json({ error: 'Beat-locked mode requires at least one pacing beat.' });
          return;
        }
        const clipResults = await Promise.all(
          beats.map(async (beat: { text?: string; startSeconds?: number; endSeconds?: number; directionNote?: string }) => {
            const beatText = String(beat.text ?? '').trim();
            if (!beatText) {
              throw new Error('Every pacing beat must contain non-empty spoken text.');
            }
            const startSeconds = Number(beat.startSeconds ?? 0);
            const endSeconds = Number(beat.endSeconds ?? 10);
            const windowSeconds = Math.max(0.5, endSeconds - startSeconds).toFixed(1);
            const beatStyle = `${String(stylePrompt).trim()} Deliver this segment cleanly within ${windowSeconds} seconds. Direction: ${String(beat.directionNote ?? '').trim()}`.trim();
            const buffer = await synthesizeSegmentWav({
              model: safeModel,
              voiceName: safeVoice,
              text: beatText,
              style: beatStyle,
            });
            return { buffer, startSeconds, endSeconds };
          }),
        );

        const assembled = assembleBeatLockedWav(clipResults, 10.0);
        const { peaks } = computeWavPeaks(assembled.wavBuffer, 96);

        res.json({
          audioBase64: assembled.wavBuffer.toString('base64'),
          mimeType: 'audio/wav',
          durationSeconds: assembled.durationSeconds,
          peaks,
          clipDurations: assembled.clipDurations,
          clippedCount: assembled.clippedCount,
          modelUsed: safeModel,
          voiceName: safeVoice,
          mode: 'beat-locked',
        });
        return;
      }

      const trimmedScript = String(script).trim();
      if (!trimmedScript) {
        res.status(400).json({ error: 'Script text cannot be empty.' });
        return;
      }

      const wavBuffer = await synthesizeSegmentWav({
        model: safeModel,
        voiceName: safeVoice,
        text: trimmedScript,
        style: String(stylePrompt).trim(),
      });

      const { peaks, durationSeconds } = computeWavPeaks(wavBuffer, 96);

      res.json({
        audioBase64: wavBuffer.toString('base64'),
        mimeType: 'audio/wav',
        durationSeconds,
        peaks,
        modelUsed: safeModel,
        voiceName: safeVoice,
        mode: 'single',
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/export-mp4', async (req, res) => {
    const { audioBase64, bedMixVolume = 0.25 } = req.body ?? {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'Generated voiceover audioBase64 is required for MP4 export.' });
      return;
    }
    if (!fs.existsSync(VIDEO_FILE_PATH)) {
      res.status(404).json({ error: 'Source video file could not be found on server.' });
      return;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trialfence-mux-'));
    const wavPath = path.join(tempDir, 'voiceover.wav');
    const outMp4Path = path.join(tempDir, 'trialfence_narrated.mp4');

    try {
      const wavBuffer = Buffer.from(audioBase64, 'base64');
      fs.writeFileSync(wavPath, wavBuffer);

      const safeBedVol = Math.max(0, Math.min(1, Number(bedMixVolume)));
      const ffmpegArgs =
        safeBedVol <= 0.01
          ? [
              '-y',
              '-i',
              VIDEO_FILE_PATH,
              '-i',
              wavPath,
              '-map',
              '0:v:0',
              '-map',
              '1:a:0',
              '-c:v',
              'copy',
              '-c:a',
              'aac',
              '-b:a',
              '192k',
              '-shortest',
              '-movflags',
              '+faststart',
              outMp4Path,
            ]
          : [
              '-y',
              '-i',
              VIDEO_FILE_PATH,
              '-i',
              wavPath,
              '-filter_complex',
              `[0:a]volume=${safeBedVol.toFixed(2)}[bed];[1:a]aresample=48000,volume=1.00[vo];[bed][vo]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`,
              '-map',
              '0:v:0',
              '-map',
              '[aout]',
              '-c:v',
              'copy',
              '-c:a',
              'aac',
              '-b:a',
              '192k',
              '-movflags',
              '+faststart',
              outMp4Path,
            ];

      await execFileAsync('ffmpeg', ffmpegArgs);

      const mp4Buffer = fs.readFileSync(outMp4Path);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="trialfence_narrated.mp4"');
      res.send(mp4Buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'FFmpeg muxing failed.';
      res.status(500).json({ error: msg });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrialFence Voice Studio listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
