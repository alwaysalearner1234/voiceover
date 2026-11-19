import React from 'react';
import { Download, Film, Loader2, Play, RotateCcw, Square, Volume2, VolumeX } from 'lucide-react';
import type { PacingBeat, VoiceTake } from '../types/studio';
import { VIDEO_DURATION_SECONDS, VIDEO_SRC, formatTimecode } from '../utils/timing';
import { TimelineTrack } from './TimelineTrack';

interface VideoStageProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bedVolume: number;
  voiceVolume: number;
  voicePlaybackRate: number;
  activeTake: VoiceTake | null;
  activeBeat: PacingBeat | null;
  beats: PacingBeat[];
  isGenerating: boolean;
  isExportingMp4: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
  onBedVolumeChange: (val: number) => void;
  onVoiceVolumeChange: (val: number) => void;
  onVoicePlaybackRateChange: (val: number) => void;
  onGenerate: () => void;
  onDownloadWav: (take: VoiceTake) => void;
  onExportMp4: (take: VoiceTake) => void;
  onLoadedMetadata: (duration: number) => void;
}

export function VideoStage({
  videoRef,
  isPlaying,
  currentTime,
  duration,
  bedVolume,
  voiceVolume,
  voicePlaybackRate,
  activeTake,
  activeBeat,
  beats,
  isGenerating,
  isExportingMp4,
  onTogglePlay,
  onRestart,
  onSeek,
  onBedVolumeChange,
  onVoiceVolumeChange,
  onVoicePlaybackRateChange,
  onGenerate,
  onDownloadWav,
  onExportMp4,
  onLoadedMetadata,
}: VideoStageProps) {
  const safeDuration = duration > 0 ? duration : VIDEO_DURATION_SECONDS;

  return (
    <section
      id="stage"
      aria-label="Synchronized video stage and timeline"
      className="flex flex-col rounded-xl border border-white/10 bg-[#11141A] overflow-hidden"
    >
      {/* 16:9 Cinema Frame */}
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          playsInline
          preload="auto"
          onClick={onTogglePlay}
          onLoadedMetadata={(e) => {
            const vidDuration = e.currentTarget.duration;
            if (Number.isFinite(vidDuration) && vidDuration > 0) {
              onLoadedMetadata(vidDuration);
            }
          }}
          className="h-full w-full cursor-pointer object-contain"
        />
      </div>

      {/* Synchronized Cue Caption Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0D1015] px-4 py-2.5 text-xs">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-mono font-medium text-blue-400 tabular-nums whitespace-nowrap shrink-0">
            {activeBeat ? activeBeat.label : '0:00–0:03'}
          </span>
          <span aria-hidden="true" className="text-white/25">
            /
          </span>
          <p className="truncate text-[#CBD5E1]">
            {activeBeat ? activeBeat.text : 'Ready to play TrialFence hook'}
          </p>
        </div>

        <div className="flex items-center gap-3 text-[#94A3B8] shrink-0">
          <span className="font-mono tabular-nums whitespace-nowrap">
            {activeTake
              ? `${activeTake.voiceName} · ${activeTake.durationSeconds.toFixed(2)}s`
              : 'Video Bed Only'}
          </span>
        </div>
      </div>

      {/* Transport & Mix Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause synchronized preview' : 'Play synchronized preview'}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#F4F6F8] px-3.5 py-2 text-xs font-semibold text-[#090B0E] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {isPlaying ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>Play Sync</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRestart}
            aria-label="Restart playback from 0:00"
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-white/10 bg-[#171B23] px-3 py-2 text-xs font-medium text-[#CBD5E1] transition-colors hover:bg-[#1E242E] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Restart</span>
          </button>

          <div
            aria-label="Current playback timecode"
            className="ml-1 font-mono text-xs text-[#F4F6F8] tabular-nums whitespace-nowrap"
          >
            {formatTimecode(currentTime)}{' '}
            <span className="text-[#64748B]">/ {formatTimecode(safeDuration)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#94A3B8]">
          <label className="flex items-center gap-2 whitespace-nowrap">
            {bedVolume <= 0.01 ? (
              <VolumeX className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-[#94A3B8]" aria-hidden="true" />
            )}
            <span>Bed Mix</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={bedVolume}
              onChange={(e) => onBedVolumeChange(Number(e.target.value))}
              aria-label="Original video bed volume"
              className="studio-slider w-16"
            />
            <span className="w-8 text-right font-mono tabular-nums text-[#CBD5E1]">
              {Math.round(bedVolume * 100)}%
            </span>
          </label>

          <label className="flex items-center gap-2 whitespace-nowrap">
            <span>Voice</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={voiceVolume}
              onChange={(e) => onVoiceVolumeChange(Number(e.target.value))}
              aria-label="Voiceover narration volume"
              className="studio-slider w-16"
            />
            <span className="w-8 text-right font-mono tabular-nums text-[#CBD5E1]">
              {Math.round(voiceVolume * 100)}%
            </span>
          </label>

          <label className="flex items-center gap-2 whitespace-nowrap">
            <span>Trim</span>
            <input
              type="range"
              min={0.9}
              max={1.15}
              step={0.01}
              value={voicePlaybackRate}
              onChange={(e) => onVoicePlaybackRateChange(Number(e.target.value))}
              aria-label="Voiceover playback speed trim"
              className="studio-slider w-16"
            />
            <span className="w-10 text-right font-mono tabular-nums text-[#CBD5E1]">
              {voicePlaybackRate.toFixed(2)}x
            </span>
          </label>
        </div>
      </div>

      {/* Interactive 10s Waveform & Cue Timeline */}
      <div className="border-t border-white/10 bg-[#0C0F14] p-4">
        <TimelineTrack
          duration={safeDuration}
          currentTime={currentTime}
          beats={beats}
          activeTake={activeTake}
          isGenerating={isGenerating}
          onSeek={onSeek}
          onGenerate={onGenerate}
        />
      </div>

      {/* Export Footer inside Stage */}
      {activeTake && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#11141A] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
            <span className="font-medium text-[#F4F6F8]">Active Take</span>
            <span aria-hidden="true">·</span>
            <span>{activeTake.voiceName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{activeTake.model}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[#CBD5E1]">
              {activeTake.durationSeconds.toFixed(2)}s
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDownloadWav(activeTake)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-white/15 bg-[#171B23] px-3 py-1.5 text-xs font-medium text-[#F4F6F8] transition-colors hover:bg-[#1E242E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Download WAV</span>
            </button>
            <button
              type="button"
              onClick={() => onExportMp4(activeTake)}
              disabled={isExportingMp4}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {isExportingMp4 ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Muxing MP4...</span>
                </>
              ) : (
                <>
                  <Film className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Export Narrated MP4</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
