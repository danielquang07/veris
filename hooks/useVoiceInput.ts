"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "listening" | "speaking" | "unsupported" | "error";

type SpeechRecognitionType = typeof window extends never
  ? never
  : new () => {
      lang: string;
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
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    setTranscript("");
    setState("listening");
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0]?.transcript ?? "";
      }
      setTranscript(text);
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
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setState("unsupported");
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      const pickVoice = () => {
        const voices = synth.getVoices();
        const vi = voices.find((v) => v.lang.toLowerCase().startsWith("vi"));
        if (vi) utter.voice = vi;
      };
      pickVoice();
      if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = pickVoice;
      }
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
