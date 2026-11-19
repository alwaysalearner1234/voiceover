export type PrebuiltVoiceName = 'Charon' | 'Fenrir' | 'Puck' | 'Kore' | 'Zephyr';

export type TtsModelId = 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts';

export type SynthesisMode = 'single' | 'beat-locked';

export interface PacingBeat {
  id: string;
  label: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  directionNote: string;
}

export interface VoiceOption {
  id: PrebuiltVoiceName;
  label: string;
  character: string;
}

export interface StylePreset {
  id: string;
  label: string;
  prompt: string;
}

export interface TimingEstimate {
  wordCount: number;
  pauseCount: number;
  speechSeconds: number;
  pauseSeconds: number;
  totalSeconds: number;
  deltaFromTarget: number;
  fitStatus: 'optimal' | 'tight' | 'short' | 'overflow';
  fitLabel: string;
}

export interface VoiceTake {
  id: string;
  createdAt: string;
  voiceName: PrebuiltVoiceName;
  model: TtsModelId;
  mode: SynthesisMode;
  stylePrompt: string;
  script: string;
  durationSeconds: number;
  audioUrl: string;
  audioBase64: string;
  peaks: number[];
  clipDurations?: number[];
  clippedCount?: number;
}
