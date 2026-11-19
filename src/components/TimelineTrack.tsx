import React, { useRef } from 'react';
import { AudioLines } from 'lucide-react';
import type { PacingBeat, VoiceTake } from '../types/studio';

interface TimelineTrackProps {
  duration: number;
  currentTime: number;
  beats: PacingBeat[];
  activeTake: VoiceTake | null;
  isGenerating: boolean;
  onSeek: (seconds: number) => void;
  onGenerate: () => void;
}

export function TimelineTrack({
  duration,
  currentTime,
  beats,
  activeTake,
  isGenerating,
  onSeek,
  onGenerate,
}: TimelineTrackProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const safeDuration = duration > 0 ? duration : 10;
  const progressPct = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100));

  const seekFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(Number((ratio * safeDuration).toFixed(2)));
  };

  return (
    <div className="space-y-2.5">
      {/* Beat Zone Headers */}
      <div className="grid grid-cols-10 gap-1 text-[11px] font-mono tabular-nums text-[#94A3B8]">
        {beats.map((beat) => {
          const spanCols = Math.max(1, Math.round(((beat.endSeconds - beat.startSeconds) / safeDuration) * 10));
          const isCurrent =
            currentTime >= beat.startSeconds &&
            (beat.id === beats[beats.length - 1]?.id
              ? currentTime <= beat.endSeconds + 0.25
              : currentTime < beat.endSeconds);
          const colClass =
            spanCols === 3 ? 'col-span-3' : spanCols === 4 ? 'col-span-4' : 'col-span-3';
          return (
            <button
              key={beat.id}
              type="button"
              onClick={() => onSeek(beat.startSeconds)}
              className={`${colClass} flex items-center justify-between rounded border px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isCurrent
                  ? 'border-blue-500/60 bg-blue-500/10 text-[#F4F6F8]'
                  : 'border-white/10 bg-[#141820] text-[#94A3B8] hover:border-white/20 hover:text-white'
              }`}
            >
              <span className="truncate font-medium">{beat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Scrub & Waveform Canvas */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Video and voiceover timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={safeDuration}
        aria-valuenow={Number(currentTime.toFixed(2))}
        onClick={(e) => seekFromClientX(e.clientX)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSeek(Math.min(safeDuration, currentTime + 0.5));
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSeek(Math.max(0, currentTime - 0.5));
          }
        }}
        className="relative h-20 w-full cursor-pointer select-none overflow-hidden rounded-lg border border-white/10 bg-[#090B0E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {/* 3.0s and 6.0s Cue Markers */}
        {beats.slice(1).map((beat) => {
          const leftPct = (beat.startSeconds / safeDuration) * 100;
          return (
            <div
              key={beat.id}
              aria-hidden="true"
              style={{ left: `${leftPct}%` }}
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white/15"
            />
          );
        })}

        {/* Waveform Bars or Empty State */}
        {activeTake && activeTake.peaks.length > 0 ? (
          <div className="flex h-full w-full items-center gap-[2px] px-2">
            {activeTake.peaks.map((peak, idx) => {
              const barTime = ((idx + 0.5) / activeTake.peaks.length) * activeTake.durationSeconds;
              const isPlayed = barTime <= currentTime;
              const heightPct = Math.max(8, Math.round(peak * 86));
              return (
                <div
                  key={idx}
                  aria-hidden="true"
                  style={{ height: `${heightPct}%` }}
                  className={`flex-1 rounded-[1px] transition-colors ${
                    isPlayed ? 'bg-blue-500' : 'bg-[#2A3342]'
                  }`}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-between px-4">
            <div className="flex items-center gap-2.5 text-xs text-[#94A3B8]">
              <AudioLines className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
              <span>
                No voiceover track generated yet. Synthesize to inspect the 10s waveform against cue markers.
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGenerate();
              }}
              disabled={isGenerating}
              className="whitespace-nowrap shrink-0 rounded-md border border-white/15 bg-[#171B23] px-3 py-1.5 text-xs font-medium text-[#F4F6F8] hover:bg-[#1E242E] disabled:opacity-50"
            >
              {isGenerating ? 'Synthesizing...' : 'Generate Track'}
            </button>
          </div>
        )}

        {/* Playhead Needle */}
        <div
          aria-hidden="true"
          style={{ left: `${progressPct}%` }}
          className="pointer-events-none absolute inset-y-0 z-20 w-[2px] -translate-x-1/2 bg-[#F4F6F8]"
        >
          <div className="h-2.5 w-2.5 -translate-x-[4px] rounded-b-sm bg-[#F4F6F8]" />
        </div>
      </div>

      {/* Second-by-Second Scale */}
      <div className="flex justify-between font-mono text-[11px] tabular-nums text-[#64748B]">
        <span>0:00</span>
        <span>0:02</span>
        <span>0:04</span>
        <span>0:06</span>
        <span>0:08</span>
        <span>0:10</span>
      </div>
    </div>
  );
}
