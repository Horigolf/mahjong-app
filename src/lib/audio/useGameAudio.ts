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
  /** 部屋 rule_config の初期値（未設定は false） */
  se: boolean;
  bgm: boolean;
};

/**
 * 対局画面の音声ライフサイクル。
 * 部屋設定は初期値。システム UI からいつでも SE/BGM を手動 ON/OFF できる。
 */
export function useGameAudio({ se, bgm }: UseGameAudioOptions) {
  const [unlocked, setUnlocked] = useState(false);
  const [seOn, setSeOn] = useState(se);
  const [bgmOn, setBgmOn] = useState(bgm);
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(() => getBgmVolume());
  const bgmOnRef = useRef(bgmOn);

  useEffect(() => {
    setSeOn(se);
  }, [se]);

  useEffect(() => {
    setBgmOn(bgm);
  }, [bgm]);

  useEffect(() => {
    bgmOnRef.current = bgmOn;
  }, [bgmOn]);

  useEffect(() => {
    setSeEnabled(seOn);
    preloadSoundEffects();
  }, [seOn]);

  useEffect(() => {
    setBgmEnabled(bgmOn);
    if (!bgmOn) {
      stopBgm();
      return;
    }
    if (isAudioUnlocked()) {
      void startBgm().then(() => setPaused(isBgmPaused()));
    }
  }, [bgmOn]);

  useEffect(() => {
    const detach = attachAudioUnlockListeners(document);
    const poll = window.setInterval(() => {
      if (!isAudioUnlocked()) return;
      setUnlocked(true);
      if (bgmOnRef.current) {
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
    if (bgmOnRef.current) {
      await startBgm();
      setPaused(isBgmPaused());
    }
  }

  async function handleToggleSe() {
    await unlockAudio();
    setUnlocked(true);
    setSeOn((v) => !v);
  }

  async function handleToggleBgm() {
    await unlockAudio();
    setUnlocked(true);
    setBgmOn((v) => {
      const next = !v;
      bgmOnRef.current = next;
      return next;
    });
  }

  async function handleTogglePause() {
    await unlockAudio();
    setUnlocked(true);
    if (!bgmOnRef.current) {
      setBgmOn(true);
      bgmOnRef.current = true;
      return;
    }
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
    seOn,
    bgmOn,
    /** コントロールは常時表示（部屋設定に依存しない） */
    bgmAvailable: true,
    handleUnlockClick,
    handleToggleSe,
    handleToggleBgm,
    handleTogglePause,
    handleVolume,
  };
}
