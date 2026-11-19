import { Loader2, Mic } from 'lucide-react';

interface TopBarProps {
  isGenerating: boolean;
  onGenerate: () => void;
}

export function TopBar({ isGenerating, onGenerate }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#090B0E]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        <a
          href="#stage"
          className="whitespace-nowrap shrink-0 text-base font-semibold tracking-tight text-[#F4F6F8] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          TrialFence Studio
        </a>

        <nav
          aria-label="Studio sections"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#94A3B8]"
        >
          <a
            href="#stage"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#F4F6F8] hover:underline underline-offset-4"
          >
            Stage &amp; Timeline
          </a>
          <a
            href="#direction"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#F4F6F8] hover:underline underline-offset-4"
          >
            Voice Direction
          </a>
          <a
            href="#takes"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#F4F6F8] hover:underline underline-offset-4"
          >
            Takes &amp; Export
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" aria-hidden="true" />
                <span>Generate Voiceover</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
