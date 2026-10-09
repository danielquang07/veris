"use client";

import React, { useEffect, useState } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceButton } from "@/components/ui/VoiceButton";

type Props = {
  onTranscript?: (text: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function VoiceInputField({
  onTranscript,
  placeholder = "Nói để nhập số lượng hoặc ghi chú...",
  className,
  disabled,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { state, transcript, supported, startListening, stopListening } = useVoiceInput("vi-VN");
  const isListening = state === "listening";

  useEffect(() => {
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  // Trước khi mount: render skeleton cố định, giống hệt trên server
  if (!mounted) {
    return (
      <div
        className={`flex items-center gap-3 opacity-0 ${className ?? "rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"}`}
        aria-hidden
      >
        {/* Chiều cao cố định để không gây layout shift */}
        <div className="w-12 h-12" />
        <div className="h-4 w-40" />
      </div>
    );
  }

  // Sau khi mount: mới branch theo supported
  if (!supported) {
    return (
      <div
        className={`text-xs text-zinc-500 italic ${className ?? "rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"}`}
      >
        Trình duyệt không hỗ trợ Web Speech API. Vui lòng dùng Chrome/Edge.
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className ?? "rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"}`}>
      <VoiceButton
        isListening={isListening}
        onStart={startListening}
        onStop={stopListening}
        disabled={disabled || !supported}
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
