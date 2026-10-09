"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "listening" | "speaking" | "unsupported" | "error";

type SpeechRecognitionType = typeof window extends never
  ? never
  : new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
      abort: () => void;
    };

function getRecognitionCtor(): SpeechRecognitionType | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return (ctor as SpeechRecognitionType | undefined) ?? null;
}

/**
 * Pick a Vietnamese voice, preferring Edge's natural online voices (HoaiMy / NamMinh).
 * Returns null when the machine has none: Chrome on Windows usually has no Vietnamese voice,
 * and falling back to an English voice reads Vietnamese text as gibberish.
 */
export function pickVietnameseVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const vi = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("vi"));
  return vi.find((v) => /natural|online/i.test(v.name)) ?? vi[0] ?? null;
}

/** getVoices() is empty until the browser has loaded its voice list - wait for it once. */
export function loadVoices(synth: SpeechSynthesis): Promise<void> {
  if (synth.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

export const NO_VIETNAMESE_VOICE_MESSAGE =
  "Máy này chưa có giọng đọc tiếng Việt nên không đọc được. Hãy mở trang bằng Microsoft Edge để nghe cảnh báo.";

/** Voice input (STT) via Web Speech API + speech synthesis (TTS) for vi-VN. No server needed. */
export function useVoiceInput(lang = "vi-VN") {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [supported] = useState(() => getRecognitionCtor() !== null || typeof window !== "undefined");
  const recRef = useRef<InstanceType<SpeechRecognitionType> | null>(null);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setState("unsupported");
      return;
    }
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = lang;
    // Keep listening through pauses until the user presses stop (default stops after one short phrase)
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    setTranscript("");
    setState("listening");
    rec.onresult = (e) => {
      // Continuous mode returns one result per phrase - join them with spaces
      const parts: string[] = [];
      for (let i = 0; i < e.results.length; i++) {
        parts.push(e.results[i][0]?.transcript ?? "");
      }
      setTranscript(parts.join(" ").replace(/\s+/g, " ").trim());
    };
    rec.onerror = () => setState("error");
    rec.onend = () => {
      setState((s) => (s === "listening" ? "idle" : s));
    };
    try {
      rec.start();
    } catch {
      setState("error");
    }
  }, [lang]);

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setState("unsupported");
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      await loadVoices(synth);
      const voice = pickVietnameseVoice(synth);
      if (!voice) {
        alert(NO_VIETNAMESE_VOICE_MESSAGE);
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.voice = voice;
      utter.onstart = () => setState("speaking");
      utter.onend = () => setState("idle");
      utter.onerror = () => setState("error");
      synth.speak(utter);
    },
    [lang],
  );

  const cancelSpeak = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setState("idle");
    }
  }, []);

  return { state, transcript, supported, startListening, stopListening, speak, cancelSpeak };
}
