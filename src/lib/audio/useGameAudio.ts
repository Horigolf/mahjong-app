"use client";

import { useEffect, useRef, useState } from "react";
import {
  attachAudioUnlockListeners,
  isAudioUnlocked,
  unlockAudio,
} from "@/lib/audio/audioUnlock";
import {
  getBgmVolume,
  isBgmPaused,
  setBgmEnabled,
  setBgmVolume,
  startBgm,
  stopBgm,
  toggleBgmPause,
} from "@/lib/audio/bgm";
import { preloadSoundEffects, setSeEnabled } from "@/lib/audio/soundEffects";

type UseGameAudioOptions = {
  se: boolean;
  bgm: boolean;
};

/**
 * 対局画面の音声ライフサイクル。
 * 最初のクリック／タップで自動再生制限を解除し、BGM を開始する。
 */
export function useGameAudio({ se, bgm }: UseGameAudioOptions) {
  const [unlocked, setUnlocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(() => getBgmVolume());
  const bgmRef = useRef(bgm);

  useEffect(() => {
    bgmRef.current = bgm;
  }, [bgm]);

  useEffect(() => {
    setSeEnabled(se);
    preloadSoundEffects();
  }, [se]);

  useEffect(() => {
    setBgmEnabled(bgm);
    if (!bgm) {
      stopBgm();
      return;
    }
    if (isAudioUnlocked()) {
      void startBgm().then(() => setPaused(isBgmPaused()));
    }
  }, [bgm]);

  useEffect(() => {
    const detach = attachAudioUnlockListeners(document);
    const poll = window.setInterval(() => {
      if (!isAudioUnlocked()) return;
      setUnlocked(true);
      if (bgmRef.current) {
        void startBgm().then(() => setPaused(isBgmPaused()));
      }
      window.clearInterval(poll);
    }, 300);

    return () => {
      detach();
      window.clearInterval(poll);
      stopBgm();
    };
  }, []);

  async function handleUnlockClick() {
    await unlockAudio();
    setUnlocked(true);
    if (bgmRef.current) {
      await startBgm();
      setPaused(isBgmPaused());
    }
  }

  async function handleTogglePause() {
    await unlockAudio();
    setUnlocked(true);
    await toggleBgmPause();
    setPaused(isBgmPaused());
  }

  function handleVolume(next: number) {
    setBgmVolume(next);
    setVolume(next);
  }

  return {
    unlocked,
    paused,
    volume,
    bgmAvailable: bgm,
    seAvailable: se,
    handleUnlockClick,
    handleTogglePause,
    handleVolume,
  };
}
