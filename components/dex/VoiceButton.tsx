"use client";

import { useVoiceInput } from "@/hooks/useVoiceInput";
import { secondaryButtonClass } from "@/components/payment/ui";

/** Small voice helpers: dictate an amount/memo, and hear a risk warning read aloud. */
export function VoiceButton({ onText, speakText }: { onText: (t: string) => void; speakText?: string | null }) {
  const { state, transcript, supported, startListening, stopListening, speak, cancelSpeak } = useVoiceInput("vi-VN");

  const listening = state === "listening";
  const speaking = state === "speaking";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={secondaryButtonClass}
        disabled={!supported || speaking}
        onClick={() => {
          if (listening) {
            stopListening();
            if (transcript.trim()) onText(transcript.trim());
          } else {
            startListening();
          }
        }}
        title={supported ? "Nhập bằng giọng nói (tiếng Việt)" : "Trình duyệt không hỗ trợ nhận dạng giọng nói"}
      >
        {listening ? "⏹ Dừng & dùng" : "🎤 Nói số lượng"}
      </button>
      {listening && transcript && <span className="text-xs text-zinc-500">“{transcript}”</span>}
      {speakText ? (
        speaking ? (
          <button type="button" className={secondaryButtonClass} onClick={cancelSpeak}>
            🔇 Dừng đọc
          </button>
        ) : (
          <button type="button" className={secondaryButtonClass} onClick={() => speak(speakText)}>
            🔊 Đọc cảnh báo
          </button>
        )
      ) : null}
      {state === "unsupported" && <span className="text-xs text-zinc-500">Trình duyệt không hỗ trợ voice.</span>}
    </div>
  );
}
