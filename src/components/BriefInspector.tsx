import { Check, Copy, RotateCcw } from 'lucide-react';
import type {
  PacingBeat,
  PrebuiltVoiceName,
  SynthesisMode,
  TimingEstimate,
  TtsModelId,
} from '../types/studio';
import { PREBUILT_VOICES, STYLE_PRESETS } from '../utils/timing';

interface BriefInspectorProps {
  voiceName: PrebuiltVoiceName;
  model: TtsModelId;
  mode: SynthesisMode;
  stylePrompt: string;
  script: string;
  targetWpm: number;
  beats: PacingBeat[];
  activeBeatIndex: number;
  timingEstimate: TimingEstimate;
  copied: boolean;
  onVoiceChange: (voice: PrebuiltVoiceName) => void;
  onModelChange: (model: TtsModelId) => void;
  onModeChange: (mode: SynthesisMode) => void;
  onStylePromptChange: (prompt: string) => void;
  onScriptChange: (script: string) => void;
  onTargetWpmChange: (wpm: number) => void;
  onBeatTextChange: (beatId: string, text: string) => void;
  onSeekToBeat: (startSeconds: number) => void;
  onCopyBrief: () => void;
  onResetBrief: () => void;
}

export function BriefInspector({
  voiceName,
  model,
  mode,
  stylePrompt,
  script,
  targetWpm,
  beats,
  activeBeatIndex,
  timingEstimate,
  copied,
  onVoiceChange,
  onModelChange,
  onModeChange,
  onStylePromptChange,
  onScriptChange,
  onTargetWpmChange,
  onBeatTextChange,
  onSeekToBeat,
  onCopyBrief,
  onResetBrief,
}: BriefInspectorProps) {
  const selectedVoice = PREBUILT_VOICES.find((v) => v.id === voiceName) ?? PREBUILT_VOICES[0];

  const fitColorClass =
    timingEstimate.fitStatus === 'optimal'
      ? 'text-emerald-400'
      : timingEstimate.fitStatus === 'tight'
        ? 'text-amber-400'
        : timingEstimate.fitStatus === 'overflow'
          ? 'text-rose-400'
          : 'text-[#94A3B8]';

  return (
    <aside
      id="direction"
      aria-label="Voice direction, script, and pacing guide"
      className="flex flex-col gap-6 rounded-xl border border-white/10 bg-[#11141A] p-5"
    >
      {/* Voice & Synthesis Settings */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[#F4F6F8]">Voice Direction &amp; Timing</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopyBrief}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-white/10 bg-[#171B23] px-3 py-1.5 text-xs font-medium text-[#CBD5E1] transition-colors hover:bg-[#1E242E] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Copied Brief</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Brief</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onResetBrief}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-white/10 bg-[#171B23] px-3 py-1.5 text-xs font-medium text-[#94A3B8] transition-colors hover:bg-[#1E242E] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="voice-select" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
              Narrator Voice
            </label>
            <select
              id="voice-select"
              value={voiceName}
              onChange={(e) => onVoiceChange(e.target.value as PrebuiltVoiceName)}
              className="w-full rounded-lg border border-white/10 bg-[#090B0E] px-3 py-2 text-sm text-[#F4F6F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {PREBUILT_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#64748B]">{selectedVoice.character}</p>
          </div>

          <div>
            <label htmlFor="model-select" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
              Speech Model
            </label>
            <select
              id="model-select"
              value={model}
              onChange={(e) => onModelChange(e.target.value as TtsModelId)}
              className="w-full rounded-lg border border-white/10 bg-[#090B0E] px-3 py-2 text-sm text-[#F4F6F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="gemini-3.8-flash-lite-tts">Flash Lite TTS (Fast Studio)</option>
              <option value="gemini-3.8-flash-tts">Flash TTS (Flagship Voice Design)</option>
            </select>
            <p className="mt-1 text-xs text-[#64748B] font-mono">{model}</p>
          </div>
        </div>

        {/* Alignment Mode Segmented Control */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-[#94A3B8]">Timing Alignment</span>
          <div
            role="group"
            aria-label="Timing alignment mode"
            className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-[#090B0E] p-1"
          >
            <button
              type="button"
              onClick={() => onModeChange('single')}
              aria-pressed={mode === 'single'}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                mode === 'single'
                  ? 'bg-[#1D232D] text-[#F4F6F8]'
                  : 'text-[#94A3B8] hover:text-[#F4F6F8]'
              }`}
            >
              Single Pass (Natural)
            </button>
            <button
              type="button"
              onClick={() => onModeChange('beat-locked')}
              aria-pressed={mode === 'beat-locked'}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                mode === 'beat-locked'
                  ? 'bg-[#1D232D] text-[#F4F6F8]'
                  : 'text-[#94A3B8] hover:text-[#F4F6F8]'
              }`}
            >
              Beat-Locked (0s / 3s / 6s)
            </button>
          </div>
        </div>
      </div>

      <div className="h-px bg-white/10" aria-hidden="true" />

      {/* Voice Style Prompt */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="style-prompt-input" className="text-xs font-medium text-[#CBD5E1]">
            Voice Style Prompt
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onStylePromptChange(preset.prompt)}
                className={`whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  stylePrompt.trim() === preset.prompt.trim()
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'bg-[#171B23] text-[#94A3B8] hover:text-[#F4F6F8]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          id="style-prompt-input"
          rows={4}
          value={stylePrompt}
          onChange={(e) => onStylePromptChange(e.target.value)}
          className="w-full resize-y rounded-lg border border-white/10 bg-[#090B0E] px-3 py-2.5 text-sm leading-relaxed text-[#F4F6F8] placeholder:text-[#64748B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
      </div>

      {/* Copy-Paste Script + Live WPM Timing Estimator */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="script-input" className="text-xs font-medium text-[#CBD5E1]">
            Narration Script
          </label>
          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <span className="font-mono tabular-nums">{timingEstimate.wordCount} words</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Est. {timingEstimate.totalSeconds.toFixed(1)}s
            </span>
            <span aria-hidden="true">·</span>
            <span className={`font-medium ${fitColorClass}`}>{timingEstimate.fitLabel}</span>
          </div>
        </div>

        <textarea
          id="script-input"
          rows={4}
          value={script}
          onChange={(e) => onScriptChange(e.target.value)}
          className="w-full resize-y rounded-lg border border-white/10 bg-[#090B0E] px-3 py-2.5 text-sm leading-relaxed text-[#F4F6F8] placeholder:text-[#64748B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />

        <div className="flex items-center justify-between gap-4 pt-1">
          <label htmlFor="wpm-range" className="text-xs text-[#94A3B8] whitespace-nowrap">
            Target Cadence
          </label>
          <div className="flex flex-1 items-center gap-3">
            <input
              id="wpm-range"
              type="range"
              min={130}
              max={175}
              step={1}
              value={targetWpm}
              onChange={(e) => onTargetWpmChange(Number(e.target.value))}
              className="studio-slider flex-1"
            />
            <span className="w-20 text-right font-mono text-xs tabular-nums text-[#F4F6F8]">
              {targetWpm} WPM
            </span>
          </div>
        </div>
      </div>

      <div className="h-px bg-white/10" aria-hidden="true" />

      {/* 3-Beat Quick Pacing Guide */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#F4F6F8]">Quick Pacing Guide</h3>
          <span className="text-xs text-[#94A3B8]">Click a cue to scrub stage</span>
        </div>

        <div className="space-y-2.5">
          {beats.map((beat, index) => {
            const isActive = index === activeBeatIndex;
            return (
              <div
                key={beat.id}
                className={`rounded-lg border p-3 transition-colors ${
                  isActive
                    ? 'border-blue-500/60 bg-blue-500/10'
                    : 'border-white/10 bg-[#0D1015]'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSeekToBeat(beat.startSeconds)}
                    aria-label={`Jump to beat ${beat.label}`}
                    className="inline-flex items-center gap-2 font-mono text-xs font-semibold tabular-nums text-blue-400 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                  >
                    <span>{beat.label}</span>
                  </button>
                  <span className="text-[11px] text-[#94A3B8]">
                    Beat {index + 1} · {(beat.endSeconds - beat.startSeconds).toFixed(0)}s window
                  </span>
                </div>

                {mode === 'beat-locked' ? (
                  <textarea
                    rows={2}
                    aria-label={`Beat ${index + 1} text (${beat.label})`}
                    value={beat.text}
                    onChange={(e) => onBeatTextChange(beat.id, e.target.value)}
                    className="w-full resize-none rounded border border-white/10 bg-[#090B0E] px-2.5 py-1.5 text-xs leading-relaxed text-[#F4F6F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm leading-snug text-[#E2E8F0]">&ldquo;{beat.text}&rdquo;</p>
                )}

                <p className="mt-1.5 text-xs text-[#94A3B8]">{beat.directionNote}</p>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
