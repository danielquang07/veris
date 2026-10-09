"use client";

import React, { useEffect } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceButton } from "@/components/ui/VoiceButton";

type Props = {
  onTranscript?: (text: string) => void;
  placeholder?: string;
  className?: string;
};

export function VoiceInputField({
  onTranscript,
  placeholder = "Nói để nhập số lượng hoặc ghi chú...",
  className,
}: Props) {
  const { state, transcript, supported, startListening, stopListening } = useVoiceInput("vi-VN");
  const isListening = state === "listening";

  useEffect(() => {
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  if (!supported) {
    return (
      <div className={`text-xs text-zinc-500 italic ${className ?? ""}`}>
        Trình duyệt không hỗ trợ Web Speech API.
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <VoiceButton
        isListening={isListening}
        onStart={startListening}
        onStop={stopListening}
        disabled={!supported}
      />
      <div className="flex-1 min-w-0">
        {isListening ? (
          <p className="text-sm text-danger animate-pulse truncate font-medium">
            {transcript || "Đang lắng nghe (tiếng Việt)..."}
          </p>
        ) : (
          <p className="text-xs text-zinc-400 truncate">
            {transcript ? `Đã nhận diện: "${transcript}"` : placeholder}
          </p>
        )}
      </div>
    </div>
  );
}
