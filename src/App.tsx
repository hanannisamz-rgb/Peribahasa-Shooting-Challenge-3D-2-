import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { GameHUD } from './components/GameHUD';
import { PauseModal } from './components/PauseModal';
import { TitleScreen } from './components/TitleScreen';
import { VictoryScreen } from './components/VictoryScreen';
import { PROVERB_QUESTIONS, type AchievementBadge } from './data/questions';
import {
  GameEngine,
  type FeedbackEvent,
  type HudSnapshot,
} from './game/GameEngine';

const INITIAL_HUD: HudSnapshot = {
  phase: 'menu',
  cameraMode: 'third-person',
  questionIndex: 0,
  totalQuestions: PROVERB_QUESTIONS.length,
  stageName: PROVERB_QUESTIONS[0].stageName,
  stageSubtitle: PROVERB_QUESTIONS[0].stageSubtitle,
  peribahasa: PROVERB_QUESTIONS[0].peribahasa,
  prompt: PROVERB_QUESTIONS[0].prompt,
  score: 0,
  maxScore: PROVERB_QUESTIONS.length * 10,
  correctCount: 0,
  stars: 0,
  remainingTargets: 3,
  shieldHealth: 3,
  maxShield: 3,
  unlockedBadges: [],
  pointerLocked: false,
  hoveredTarget: null,
  vrSupported: false,
  inVr: false,
  contextLost: false,
};

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [feedback, setFeedback] = useState<FeedbackEvent | null>(null);
  const [recentBadge, setRecentBadge] = useState<AchievementBadge | null>(null);
  const [muted, setMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    let wrongTimer: number | null = null;
    let badgeTimer: number | null = null;

    const engine = new GameEngine(container, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onFeedback: (event) => {
        if (wrongTimer) {
          window.clearTimeout(wrongTimer);
          wrongTimer = null;
        }
        setFeedback(event);
        if (event?.type === 'wrong') {
          wrongTimer = window.setTimeout(() => {
            setFeedback((curr) => (curr?.id === event.id ? null : curr));
          }, 2300);
        }
      },
      onBadgeUnlocked: (badge) => {
        if (badgeTimer) window.clearTimeout(badgeTimer);
        setRecentBadge(badge);
        badgeTimer = window.setTimeout(() => {
          setRecentBadge((curr) => (curr?.id === badge.id ? null : curr));
        }, 3200);
      },
    });

    engineRef.current = engine;

    return () => {
      if (wrongTimer) window.clearTimeout(wrongTimer);
      if (badgeTimer) window.clearTimeout(badgeTimer);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (!next) soundEngine.unlock();
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleMusic = useCallback(() => {
    setMusicMuted((prev) => {
      const next = !prev;
      if (!next) soundEngine.unlock();
      soundEngine.setMusicMuted(next);
      return next;
    });
  }, []);

  const handleToggleCameraMode = useCallback(() => {
    engineRef.current?.toggleCameraMode();
  }, []);

  const handleStartGame = useCallback(() => {
    engineRef.current?.startNewGame();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleMainMenu = useCallback(() => {
    engineRef.current?.returnToMenu();
  }, []);

  const handleEnterVr = useCallback(() => {
    engineRef.current?.enterVr();
  }, []);

  const handleAdvanceNext = useCallback(() => {
    engineRef.current?.advanceToNextQuestion();
  }, []);

  const handleRequestPointerLock = useCallback(() => {
    engineRef.current?.requestPointerLock();
  }, []);

  const handleMobileMove = useCallback((x: number, y: number) => {
    engineRef.current?.setMobileMove(x, y);
  }, []);

  const handleMobileLook = useCallback((dx: number, dy: number) => {
    engineRef.current?.addLookDelta(dx, dy);
  }, []);

  const handleMobileShoot = useCallback(() => {
    engineRef.current?.triggerShoot();
  }, []);

  const handleMobileJump = useCallback(() => {
    engineRef.current?.triggerJump();
  }, []);

  const getMousePercent = useCallback(() => {
    return engineRef.current?.getMouseScreenPercent() ?? null;
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060919]">
      {/* Dedicated WebGL Canvas Container */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* WebGL Context Lost Safety Overlay */}
      {hud.contextLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#060919]/95 p-6 text-center">
          <div className="max-w-md bg-[#08112e] border border-cyan-400/50 rounded-2xl p-6 space-y-3">
            <h2 className="font-display font-extrabold text-[22px] sm:text-[24px] text-white">
              Paparan 3D Sedang Dipulihkan
            </h2>
            <p className="text-[16px] sm:text-[18px] font-semibold text-slate-200 leading-relaxed">
              Sambungan grafik WebGL terganggu sebentar. Sila tunggu sebentar atau muat semula halaman.
            </p>
          </div>
        </div>
      )}

      {/* Title Screen */}
      {hud.phase === 'menu' && (
        <TitleScreen
          muted={muted}
          musicMuted={musicMuted}
          vrSupported={hud.vrSupported}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onStartGame={handleStartGame}
          onEnterVr={handleEnterVr}
        />
      )}

      {/* Active Gameplay HUD */}
      {(hud.phase === 'playing' || hud.phase === 'transition' || hud.phase === 'paused') && (
        <GameHUD
          hud={hud}
          feedback={feedback}
          recentBadge={recentBadge}
          muted={muted}
          musicMuted={musicMuted}
          mobileControlsOpen={mobileControlsOpen}
          onToggleMobileControls={() => setMobileControlsOpen((v) => !v)}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onToggleCameraMode={handleToggleCameraMode}
          onPause={handlePause}
          onEnterVr={handleEnterVr}
          onAdvanceNext={handleAdvanceNext}
          onRequestPointerLock={handleRequestPointerLock}
          onMobileMove={handleMobileMove}
          onMobileLook={handleMobileLook}
          onMobileShoot={handleMobileShoot}
          onMobileJump={handleMobileJump}
          getMousePercent={getMousePercent}
        />
      )}

      {/* Pause Modal */}
      {hud.phase === 'paused' && (
        <PauseModal
          score={hud.score}
          questionNumber={hud.questionIndex + 1}
          totalQuestions={hud.totalQuestions}
          onResume={handleResume}
          onRestart={handleStartGame}
          onMainMenu={handleMainMenu}
        />
      )}

      {/* Final Victory Screen */}
      {hud.phase === 'victory' && (
        <VictoryScreen
          score={hud.score}
          maxScore={hud.maxScore}
          totalQuestions={hud.totalQuestions}
          stars={hud.stars}
          unlockedBadges={hud.unlockedBadges}
          onPlayAgain={handleStartGame}
          onMainMenu={handleMainMenu}
        />
      )}
    </div>
  );
}
