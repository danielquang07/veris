"use client";

import React from "react";
import { Mic, MicOff } from "lucide-react";

type Props = {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
};

export function VoiceButton({ isListening, onStart, onStop, disabled }: Props) {
  return (
    <div className="relative inline-flex">
      {isListening && (
        <span className="absolute inset-0 rounded-full bg-danger/40 animate-ping" aria-hidden />
      )}
      <button
        type="button"
        onClick={isListening ? onStop : onStart}
        disabled={disabled}
        className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-150 disabled:opacity-50 ${
          isListening ? "bg-danger text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
        }`}
        aria-label={isListening ? "Dừng ghi âm" : "Bắt đầu nói"}
      >
        {isListening ? <MicOff size={20} /> : <Mic size={20} />}
      </button>
    </div>
  );
}
