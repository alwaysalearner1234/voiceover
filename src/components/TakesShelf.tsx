import { CheckCircle2, Download, Film, Loader2, Play } from 'lucide-react';
import type { VoiceTake } from '../types/studio';

interface TakesShelfProps {
  takes: VoiceTake[];
  activeTakeId: string | null;
  exportingTakeId: string | null;
  onSelectTake: (take: VoiceTake) => void;
  onDownloadWav: (take: VoiceTake) => void;
  onExportMp4: (take: VoiceTake) => void;
}

export function TakesShelf({
  takes,
  activeTakeId,
  exportingTakeId,
  onSelectTake,
  onDownloadWav,
  onExportMp4,
}: TakesShelfProps) {
  return (
    <section
      id="takes"
      aria-label="Synthesized voiceover takes and export"
      className="rounded-xl border border-white/10 bg-[#11141A] p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#F4F6F8]">Synthesized Takes &amp; Export</h2>
          <p className="mt-0.5 text-xs text-[#94A3B8]">
            Compare generated narration passes against the 10.00s video frame and export WAV or muxed MP4.
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-[#94A3B8]">
          {takes.length} {takes.length === 1 ? 'take' : 'takes'}
        </span>
      </div>

      {takes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 bg-[#090B0E] px-4 py-8 text-center">
          <p className="text-sm font-medium text-[#CBD5E1]">No voiceover takes synthesized yet</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Click <span className="text-[#F4F6F8]">Generate Voiceover</span> to synthesize your first Gemini TTS track and unlock WAV / narrated MP4 export.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#94A3B8]">
                <th className="py-2.5 pr-4 font-medium">Take</th>
                <th className="py-2.5 pr-4 font-medium">Voice &amp; Model</th>
                <th className="py-2.5 pr-4 font-medium">Mode</th>
                <th className="py-2.5 pr-4 font-medium text-right">Duration</th>
                <th className="py-2.5 pr-4 font-medium">10s Fit</th>
                <th className="py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {takes.map((take, idx) => {
                const isActive = take.id === activeTakeId;
                const isExporting = exportingTakeId === take.id;
                const delta = take.durationSeconds - 10.0;
                const fitText =
                  Math.abs(delta) <= 0.45
                    ? 'Fits 10s frame'
                    : delta > 0.45
                      ? `+${delta.toFixed(2)}s over`
                      : `${Math.abs(delta).toFixed(2)}s under`;
                const fitClass =
                  Math.abs(delta) <= 0.45
                    ? 'text-emerald-400'
                    : delta > 0.45
                      ? 'text-amber-400'
                      : 'text-[#CBD5E1]';

                return (
                  <tr
                    key={take.id}
                    className={isActive ? 'bg-blue-500/5' : 'hover:bg-white/[0.02]'}
                  >
                    <td className="py-3 pr-4 font-mono tabular-nums text-[#F4F6F8]">
                      <div className="flex items-center gap-2">
                        <span>#{takes.length - idx}</span>
                        {isActive && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" aria-label="Active take" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-[#F4F6F8]">{take.voiceName}</div>
                      <div className="font-mono text-[11px] text-[#64748B]">{take.model}</div>
                    </td>
                    <td className="py-3 pr-4 text-[#CBD5E1]">
                      {take.mode === 'beat-locked' ? 'Beat-Locked (0/3/6s)' : 'Single Pass'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#F4F6F8]">
                      {take.durationSeconds.toFixed(2)}s
                    </td>
                    <td className={`py-3 pr-4 font-medium ${fitClass}`}>{fitText}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectTake(take)}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-white/10 bg-[#171B23] px-2.5 py-1 text-[11px] font-medium text-[#F4F6F8] hover:bg-[#1E242E]"
                        >
                          <Play className="h-3 w-3" aria-hidden="true" />
                          <span>{isActive ? 'Audition' : 'Load'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDownloadWav(take)}
                          aria-label={`Download WAV for take ${takes.length - idx}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-white/10 bg-[#171B23] px-2.5 py-1 text-[11px] font-medium text-[#CBD5E1] hover:bg-[#1E242E] hover:text-white"
                        >
                          <Download className="h-3 w-3" aria-hidden="true" />
                          <span>WAV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportMp4(take)}
                          disabled={isExporting}
                          aria-label={`Export narrated MP4 for take ${takes.length - idx}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                        >
                          {isExporting ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <Film className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>MP4</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
