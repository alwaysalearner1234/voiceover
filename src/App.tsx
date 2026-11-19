import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { BriefInspector } from './components/BriefInspector';
import { TakesShelf } from './components/TakesShelf';
import { TopBar } from './components/TopBar';
import { VideoStage } from './components/VideoStage';
import type {
  PacingBeat,
  PrebuiltVoiceName,
  SynthesisMode,
  TtsModelId,
  VoiceTake,
} from './types/studio';
import {
  DEFAULT_PACING_BEATS,
  DEFAULT_SCRIPT,
  DEFAULT_TARGET_WPM,
  DEFAULT_VOICE_STYLE_PROMPT,
  VIDEO_DURATION_SECONDS,
  buildCopyBriefText,
  estimateNarrationDuration,
  getActiveBeatIndex,
} from './utils/timing';

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType });
  return URL.createObjectURL(blob);
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [voiceName, setVoiceName] = useState<PrebuiltVoiceName>('Charon');
  const [model, setModel] = useState<TtsModelId>('gemini-3.8-flash-lite-tts');
  const [mode, setMode] = useState<SynthesisMode>('single');
  const [stylePrompt, setStylePrompt] = useState<string>(DEFAULT_VOICE_STYLE_PROMPT);
  const [script, setScript] = useState<string>(DEFAULT_SCRIPT);
  const [targetWpm, setTargetWpm] = useState<number>(DEFAULT_TARGET_WPM);
  const [beats, setBeats] = useState<PacingBeat[]>(DEFAULT_PACING_BEATS);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(VIDEO_DURATION_SECONDS);
  const [bedVolume, setBedVolume] = useState(0.25);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [voicePlaybackRate, setVoicePlaybackRate] = useState(1.0);

  const [takes, setTakes] = useState<VoiceTake[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportingTakeId, setExportingTakeId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeTake = useMemo(
    () => takes.find((t) => t.id === activeTakeId) ?? null,
    [takes, activeTakeId],
  );

  const timingEstimate = useMemo(
    () => estimateNarrationDuration(script, targetWpm, videoDuration),
    [script, targetWpm, videoDuration],
  );

  const activeBeatIndex = useMemo(
    () => getActiveBeatIndex(currentTime, beats),
    [currentTime, beats],
  );

  const activeBeat = activeBeatIndex >= 0 ? beats[activeBeatIndex] : null;

  // Keep element volumes & playbackRate synced
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = bedVolume;
      videoRef.current.muted = bedVolume <= 0.01;
    }
  }, [bedVolume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = voiceVolume;
      audioRef.current.playbackRate = voicePlaybackRate;
    }
  }, [voiceVolume, voicePlaybackRate, activeTakeId]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      takes.forEach((t) => URL.revokeObjectURL(t.audioUrl));
    };
  }, []);

  // Frame-accurate playback sync loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (video) {
        const vTime = video.currentTime;
        setCurrentTime(vTime);

        if (audio && activeTake) {
          const expectedAudioTime = vTime * voicePlaybackRate;
          if (expectedAudioTime < audio.duration) {
            if (audio.paused && !video.paused) {
              audio.currentTime = expectedAudioTime;
              audio.play().catch(() => {});
            } else if (Math.abs(audio.currentTime - expectedAudioTime) > 0.09) {
              audio.currentTime = expectedAudioTime;
            }
          }
        }

        if (video.ended) {
          setIsPlaying(false);
          if (audio && !audio.paused) audio.pause();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, activeTake, voicePlaybackRate]);

  const handleSeek = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, Math.min(videoDuration, seconds));
      setCurrentTime(clamped);
      if (videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
      if (audioRef.current && activeTake) {
        const audioTarget = clamped * voicePlaybackRate;
        if (Number.isFinite(audioRef.current.duration)) {
          audioRef.current.currentTime = Math.min(audioTarget, audioRef.current.duration);
        } else {
          audioRef.current.currentTime = audioTarget;
        }
      }
    },
    [videoDuration, activeTake, voicePlaybackRate],
  );

  const handleTogglePlay = useCallback(async () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      if (audio && !audio.paused) audio.pause();
      setIsPlaying(false);
      return;
    }

    if (video.ended || video.currentTime >= videoDuration - 0.05) {
      video.currentTime = 0;
      setCurrentTime(0);
      if (audio) audio.currentTime = 0;
    } else if (audio && activeTake) {
      audio.currentTime = video.currentTime * voicePlaybackRate;
    }

    try {
      await video.play();
      if (audio && activeTake) {
        audio.playbackRate = voicePlaybackRate;
        audio.volume = voiceVolume;
        await audio.play().catch(() => {});
      }
      setIsPlaying(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start playback.');
    }
  }, [isPlaying, videoDuration, activeTake, voicePlaybackRate, voiceVolume]);

  const handleRestart = useCallback(async () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    video.currentTime = 0;
    setCurrentTime(0);
    if (audio && activeTake) {
      audio.currentTime = 0;
    }

    try {
      await video.play();
      if (audio && activeTake) {
        audio.playbackRate = voicePlaybackRate;
        await audio.play().catch(() => {});
      }
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [activeTake, voicePlaybackRate]);

  const handleGenerate = useCallback(async () => {
    setErrorMsg(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          model,
          voiceName,
          stylePrompt,
          script,
          beats,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `TTS generation failed (${response.status})`);
      }

      const audioUrl = base64ToBlobUrl(payload.audioBase64, payload.mimeType || 'audio/wav');
      const newTake: VoiceTake = {
        id: `take-${Date.now()}`,
        createdAt: new Date().toISOString(),
        voiceName: payload.voiceName || voiceName,
        model: payload.modelUsed || model,
        mode: payload.mode || mode,
        stylePrompt,
        script,
        durationSeconds: Number(payload.durationSeconds || 0),
        audioUrl,
        audioBase64: payload.audioBase64,
        peaks: Array.isArray(payload.peaks) ? payload.peaks : [],
        clipDurations: payload.clipDurations,
        clippedCount: payload.clippedCount,
      };

      setTakes((prev) => [newTake, ...prev]);
      setActiveTakeId(newTake.id);

      // Pause any active playback and rewind cleanly so the user can audition immediately
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      setCurrentTime(0);
      setIsPlaying(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Voiceover synthesis failed.');
    } finally {
      setIsGenerating(false);
    }
  }, [mode, model, voiceName, stylePrompt, script, beats]);

  const handleSelectTake = useCallback(
    (take: VoiceTake) => {
      setActiveTakeId(take.id);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
      setCurrentTime(0);
      setIsPlaying(false);
    },
    [],
  );

  const handleDownloadWav = useCallback((take: VoiceTake) => {
    const link = document.createElement('a');
    link.href = take.audioUrl;
    link.download = `trialfence_${take.voiceName.toLowerCase()}_${take.mode}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleExportMp4 = useCallback(
    async (take: VoiceTake) => {
      setErrorMsg(null);
      setExportingTakeId(take.id);
      try {
        const response = await fetch('/api/export-mp4', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: take.audioBase64,
            bedMixVolume: bedVolume,
          }),
        });

        if (!response.ok) {
          const errPayload = await response.json().catch(() => ({}));
          throw new Error(errPayload?.error || `MP4 export failed (${response.status})`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `trialfence_narrated_${take.voiceName.toLowerCase()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'MP4 export failed.');
      } finally {
        setExportingTakeId(null);
      }
    },
    [bedVolume],
  );

  const handleCopyBrief = useCallback(async () => {
    const text = buildCopyBriefText(stylePrompt, script, beats, targetWpm);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMsg('Clipboard access was denied by the browser.');
    }
  }, [stylePrompt, script, beats, targetWpm]);

  const handleResetBrief = useCallback(() => {
    setStylePrompt(DEFAULT_VOICE_STYLE_PROMPT);
    setScript(DEFAULT_SCRIPT);
    setTargetWpm(DEFAULT_TARGET_WPM);
    setBeats(DEFAULT_PACING_BEATS);
  }, []);

  const handleBeatTextChange = useCallback((beatId: string, text: string) => {
    setBeats((prev) => prev.map((b) => (b.id === beatId ? { ...b, text } : b)));
  }, []);

  return (
    <div className="min-h-screen bg-[#090B0E] text-[#F4F6F8]">
      <TopBar isGenerating={isGenerating} onGenerate={handleGenerate} />

      {/* Hidden synced audio element for active take */}
      <audio
        ref={audioRef}
        src={activeTake?.audioUrl || undefined}
        preload="auto"
        onEnded={() => {
          // Video remains master clock
        }}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Compact Page Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-medium text-blue-400">
              TrialFence Problem Hook · 1280×720 · 10.00s Master
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#F4F6F8] sm:text-3xl text-balance">
              Voiceover Direction &amp; Sync Workbench
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
            <span className="font-mono tabular-nums">Target: 145–150 WPM</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Runtime: 9.5–10.0s</span>
            <span aria-hidden="true">·</span>
            <span>3-Beat Timed Delivery</span>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
              <span className="min-w-0 break-words">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              aria-label="Dismiss error message"
              className="shrink-0 rounded p-1 text-rose-300 hover:bg-rose-900/40 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Primary Two-Column Studio Workspace */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <div className="space-y-6 lg:col-span-7">
            <VideoStage
              videoRef={videoRef}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={videoDuration}
              bedVolume={bedVolume}
              voiceVolume={voiceVolume}
              voicePlaybackRate={voicePlaybackRate}
              activeTake={activeTake}
              activeBeat={activeBeat}
              beats={beats}
              isGenerating={isGenerating}
              isExportingMp4={exportingTakeId !== null}
              onTogglePlay={handleTogglePlay}
              onRestart={handleRestart}
              onSeek={handleSeek}
              onBedVolumeChange={setBedVolume}
              onVoiceVolumeChange={setVoiceVolume}
              onVoicePlaybackRateChange={setVoicePlaybackRate}
              onGenerate={handleGenerate}
              onDownloadWav={handleDownloadWav}
              onExportMp4={handleExportMp4}
              onLoadedMetadata={setVideoDuration}
            />

            <TakesShelf
              takes={takes}
              activeTakeId={activeTakeId}
              exportingTakeId={exportingTakeId}
              onSelectTake={handleSelectTake}
              onDownloadWav={handleDownloadWav}
              onExportMp4={handleExportMp4}
            />
          </div>

          <div className="lg:col-span-5">
            <BriefInspector
              voiceName={voiceName}
              model={model}
              mode={mode}
              stylePrompt={stylePrompt}
              script={script}
              targetWpm={targetWpm}
              beats={beats}
              activeBeatIndex={activeBeatIndex}
              timingEstimate={timingEstimate}
              copied={copied}
              onVoiceChange={setVoiceName}
              onModelChange={setModel}
              onModeChange={setMode}
              onStylePromptChange={setStylePrompt}
              onScriptChange={setScript}
              onTargetWpmChange={setTargetWpm}
              onBeatTextChange={handleBeatTextChange}
              onSeekToBeat={handleSeek}
              onCopyBrief={handleCopyBrief}
              onResetBrief={handleResetBrief}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
