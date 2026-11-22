import { useEffect, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Eye,
  Glasses,
  Music,
  Pause,
  Shield,
  Smartphone,
  Star,
  Target,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import type { AchievementBadge } from '../data/questions';
import type { FeedbackEvent, HudSnapshot } from '../game/GameEngine';

interface GameHUDProps {
  hud: HudSnapshot;
  feedback: FeedbackEvent | null;
  recentBadge: AchievementBadge | null;
  muted: boolean;
  musicMuted: boolean;
  mobileControlsOpen: boolean;
  onToggleMobileControls: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onToggleCameraMode: () => void;
  onPause: () => void;
  onEnterVr: () => void;
  onAdvanceNext: () => void;
  onRequestPointerLock: () => void;
  onMobileMove: (x: number, y: number) => void;
  onMobileLook: (dx: number, dy: number) => void;
  onMobileShoot: () => void;
  onMobileJump: () => void;
  getMousePercent: () => { x: number; y: number } | null;
}

export function GameHUD({
  hud,
  feedback,
  recentBadge,
  muted,
  musicMuted,
  mobileControlsOpen,
  onToggleMobileControls,
  onToggleMute,
  onToggleMusic,
  onToggleCameraMode,
  onPause,
  onEnterVr,
  onAdvanceNext,
  onRequestPointerLock,
  onMobileMove,
  onMobileLook,
  onMobileShoot,
  onMobileJump,
  getMousePercent,
}: GameHUDProps) {
  const [reticlePos, setReticlePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const [stickKnob, setStickKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const stickTouchId = useRef<number | null>(null);
  const aimTouchId = useRef<number | null>(null);
  const lastAimPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync reticle position when playing unlocked on desktop
  useEffect(() => {
    if (hud.pointerLocked) {
      setReticlePos({ x: 50, y: 50 });
      return;
    }
    const handleMove = () => {
      const pos = getMousePercent();
      if (pos) setReticlePos(pos);
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [hud.pointerLocked, getMousePercent]);

  const progressPct = Math.round(((hud.correctCount) / hud.totalQuestions) * 100);

  // Virtual Joystick handlers
  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joystickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setStickKnob({ x: dx, y: dy });
    onMobileMove(dx / maxR, -dy / maxR);
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* TOP BAR & BALANCED QUESTION PANEL */}
      <div className="flex flex-col gap-2 w-full max-w-6xl mx-auto">
        {/* Compact High-Contrast Status & Score Strip */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2.5 bg-[#08112e]/92 border border-cyan-400/45 rounded-xl px-4 py-2 shadow-lg">
          {/* Left: Stage + Question Progress */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="min-w-0">
              <div className="font-display font-bold text-[15px] sm:text-[17px] text-cyan-300 truncate leading-tight">
                {hud.stageName}
              </div>
              <div className="flex items-center gap-2 text-[14px] sm:text-[16px] font-bold text-white tabular-nums leading-tight mt-0.5">
                <span>
                  Soalan {hud.questionIndex + 1}/{hud.totalQuestions}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-300">Betul: {hud.correctCount}/{hud.totalQuestions}</span>
              </div>
            </div>

            {/* 7-Question Progress Bar */}
            <div className="hidden lg:flex flex-col gap-1 w-36">
              <div className="flex items-center justify-between text-[14px] font-bold text-slate-200 tabular-nums leading-none">
                <span>Kemajuan</span>
                <span className="text-cyan-300">{progressPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex gap-0.5 p-0.5">
                {Array.from({ length: hud.totalQuestions }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full ${
                      i < hud.correctCount
                        ? 'bg-cyan-400'
                        : i === hud.questionIndex
                          ? 'bg-purple-400'
                          : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Center: Score, Stars, Active Targets, Shield */}
          <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 text-[16px] sm:text-[19px] lg:text-[20px] font-extrabold tabular-nums">
            <div className="flex items-center gap-1 text-cyan-300">
              <span>Skor:</span>
              <span className="text-white">{hud.score}</span>
              <span className="text-slate-300 text-[14px] sm:text-[16px]">/{hud.maxScore}</span>
            </div>

            <div className="flex items-center gap-1 text-amber-300">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400 shrink-0" />
              <span>{hud.stars}</span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-white text-[16px] sm:text-[18px]">
              <Target className="w-4 h-4 text-purple-300 shrink-0" />
              <span>Sasaran: {hud.remainingTargets}</span>
            </div>

            <div
              className="hidden sm:flex items-center gap-1.5 text-cyan-200"
              title="Perisai Tenaga"
            >
              <Shield className="w-5 h-5 text-cyan-400 shrink-0" />
              <div className="flex gap-1">
                {Array.from({ length: hud.maxShield }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`w-2.5 h-3.5 rounded-sm ${
                      idx < hud.shieldHealth ? 'bg-cyan-400' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {!hud.inVr && (
              <button
                type="button"
                onClick={onToggleCameraMode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111e4d] hover:bg-[#192963] border border-cyan-400/55 text-[14px] sm:text-[16px] lg:text-[18px] font-display font-bold text-white transition-colors cursor-pointer whitespace-nowrap"
                title="Tukar Kamera (Tekan V)"
                aria-label="Tukar Perspektif Kamera"
              >
                <Eye className="w-4 h-4 text-cyan-300 shrink-0" />
                <span>
                  {hud.cameraMode === 'first-person' ? 'FIRST PERSON' : 'THIRD PERSON'}
                </span>
              </button>
            )}

            {hud.vrSupported && !hud.inVr && (
              <button
                type="button"
                onClick={onEnterVr}
                className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 border border-purple-300/50 text-white transition-colors cursor-pointer"
                title="Masuk Mod VR"
                aria-label="Masuk Mod VR"
              >
                <Glasses className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onToggleMobileControls}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                mobileControlsOpen
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                  : 'bg-[#111e4d] border-white/20 text-white hover:bg-[#192963]'
              }`}
              title="Kawalan Sentuh"
              aria-label="Kawalan Sentuh"
            >
              <Smartphone className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleMusic}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                musicMuted
                  ? 'bg-[#111e4d] border-white/20 text-slate-400 hover:text-white'
                  : 'bg-[#111e4d] border-purple-400/55 text-purple-200 hover:bg-[#192963]'
              }`}
              title={musicMuted ? 'Buka Lagu Latar' : 'Matikan Lagu Latar'}
              aria-label={musicMuted ? 'Buka Lagu Latar' : 'Matikan Lagu Latar'}
            >
              <Music className={`w-4 h-4 ${musicMuted ? 'opacity-50' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="p-2 rounded-lg bg-[#111e4d] border border-white/20 text-white hover:bg-[#192963] transition-colors cursor-pointer"
              title={muted ? 'Buka Bunyi' : 'Senyapkan Bunyi'}
              aria-label={muted ? 'Buka Bunyi' : 'Senyapkan Bunyi'}
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
            </button>

            <button
              type="button"
              onClick={onPause}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111e4d] hover:bg-[#192963] border border-white/25 text-[15px] sm:text-[18px] font-display font-bold text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <Pause className="w-4 h-4 shrink-0" />
              <span>Jeda</span>
            </button>
          </div>
        </div>

        {/* Compact, Wide, Stationary Proverb Question Panel */}
        <div className="mx-auto max-w-4xl w-full bg-[#08112e]/92 border border-cyan-400/60 rounded-2xl px-5 py-2.5 sm:px-7 sm:py-3 shadow-xl text-center">
          <div className="text-[14px] sm:text-[15px] font-bold text-cyan-300 leading-snug">
            Peribahasa {hud.questionIndex + 1} · Tembak Sasaran A, B atau C
          </div>
          <h2 className="font-display font-extrabold text-[19px] sm:text-[22px] lg:text-[25px] text-white mt-0.5 leading-snug break-words">
            {hud.peribahasa}
          </h2>
          <p className="text-[15px] sm:text-[17px] lg:text-[18px] font-bold text-amber-200 mt-0.5 leading-snug">
            {hud.prompt}
          </p>
        </div>
      </div>

      {/* CENTER CROSSHAIR (Clean & Stationary) */}
      {hud.phase === 'playing' && !hud.inVr && (
        <div
          className="fixed pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${reticlePos.x}%`, top: `${reticlePos.y}%` }}
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 44 44"
          >
            <circle
              cx="22"
              cy="22"
              r="14"
              fill="none"
              stroke={hud.hoveredTarget ? '#22d3ee' : 'rgba(255,255,255,0.85)'}
              strokeWidth={hud.hoveredTarget ? '2.8' : '1.9'}
            />
            <line
              x1="22"
              y1="3"
              x2="22"
              y2="11"
              stroke={hud.hoveredTarget ? '#22d3ee' : '#ffffff'}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <line
              x1="22"
              y1="33"
              x2="22"
              y2="41"
              stroke={hud.hoveredTarget ? '#22d3ee' : '#ffffff'}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <line
              x1="3"
              y1="22"
              x2="11"
              y2="22"
              stroke={hud.hoveredTarget ? '#22d3ee' : '#ffffff'}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <line
              x1="33"
              y1="22"
              x2="41"
              y2="22"
              stroke={hud.hoveredTarget ? '#22d3ee' : '#ffffff'}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle
              cx="22"
              cy="22"
              r="2.8"
              fill={hud.hoveredTarget ? '#22d3ee' : '#fbbf24'}
            />
          </svg>
        </div>
      )}

      {/* IMMEDIATE FEEDBACK BANNER (24-28px, CLEAR, STATIONARY) */}
      {feedback && (
        <div className="pointer-events-auto mx-auto max-w-xl w-full my-auto">
          {feedback.type === 'correct' ? (
            <div className="bg-[#064034] border-2 border-emerald-400 rounded-2xl p-5 sm:p-6 shadow-2xl text-center space-y-3">
              <div className="flex items-center justify-center gap-2.5 text-white font-display font-extrabold text-[22px] sm:text-[26px] lg:text-[28px] leading-snug">
                <CheckCircle2 className="w-7 h-7 text-emerald-300 shrink-0" />
                <span>{feedback.title}</span>
              </div>
              <div className="text-[16px] sm:text-[18px] text-emerald-200 font-bold">
                +10 Mata · +1 Bintang Pencapaian
              </div>
              {feedback.explanation && (
                <p className="text-[16px] sm:text-[18px] text-white bg-[#03261f] border border-emerald-400/35 rounded-xl px-4 py-3 leading-relaxed font-semibold">
                  <strong className="text-emerald-300">Maksud:</strong> {feedback.explanation}
                </p>
              )}
              <button
                type="button"
                onClick={onAdvanceNext}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-extrabold text-[18px] sm:text-[22px] transition-colors cursor-pointer whitespace-nowrap"
              >
                {hud.questionIndex + 1 >= hud.totalQuestions
                  ? 'Lihat Keputusan Akhir'
                  : 'Soalan Seterusnya'}
              </button>
            </div>
          ) : (
            <div className="bg-[#590d22] border-2 border-rose-400 rounded-2xl px-5 py-4 shadow-2xl text-center space-y-1.5">
              <div className="flex items-center justify-center gap-2.5 text-white font-display font-extrabold text-[20px] sm:text-[24px] lg:text-[26px] leading-snug">
                <XCircle className="w-7 h-7 text-rose-300 shrink-0" />
                <span>{feedback.title}</span>
              </div>
              <p className="text-[16px] sm:text-[18px] font-semibold text-rose-100 leading-snug">
                Halakan peledak laser ke sasaran lain dan tembak semula!
              </p>
            </div>
          )}
        </div>
      )}

      {/* BADGE UNLOCK TOAST */}
      {recentBadge && (
        <div className="mx-auto mb-2 bg-[#14113d] border-2 border-amber-400 rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-2.5">
          <Award className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-[15px] sm:text-[16px] font-bold leading-snug">
            <span className="text-amber-300">Lencana Baharu Dibuka: </span>
            <span className="text-white">{recentBadge.name}</span>
          </div>
        </div>
      )}

      {/* MOBILE VIRTUAL CONTROLS */}
      {mobileControlsOpen && hud.phase === 'playing' && (
        <div className="pointer-events-none flex items-end justify-between w-full px-1 pb-2 gap-2">
          {/* Left Virtual Joystick */}
          <div
            ref={joystickRef}
            className="pointer-events-auto relative w-32 h-32 rounded-full bg-[#08112e]/88 border-2 border-cyan-400/60 flex items-center justify-center touch-none shrink-0"
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              stickTouchId.current = t.identifier;
              updateJoystick(t.clientX, t.clientY);
            }}
            onTouchMove={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === stickTouchId.current) {
                  updateJoystick(t.clientX, t.clientY);
                }
              }
            }}
            onTouchEnd={() => {
              stickTouchId.current = null;
              setStickKnob({ x: 0, y: 0 });
              onMobileMove(0, 0);
            }}
          >
            <div
              className="w-12 h-12 rounded-full bg-cyan-400 border-2 border-white shadow-lg"
              style={{ transform: `translate(${stickKnob.x}px, ${stickKnob.y}px)` }}
            />
          </div>

          {/* Center-Right Touch Aim Pad */}
          <div
            className="pointer-events-auto flex-1 h-28 mx-2 rounded-2xl border border-white/25 bg-[#08112e]/65 flex items-center justify-center text-center px-3 text-[15px] sm:text-[16px] font-bold text-white touch-none"
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              aimTouchId.current = t.identifier;
              lastAimPos.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === aimTouchId.current) {
                  const dx = t.clientX - lastAimPos.current.x;
                  const dy = t.clientY - lastAimPos.current.y;
                  lastAimPos.current = { x: t.clientX, y: t.clientY };
                  onMobileLook(dx * 1.4, dy * 1.4);
                }
              }
            }}
            onTouchEnd={() => {
              aimTouchId.current = null;
            }}
          >
            <span>Seret untuk halakan kamera</span>
          </div>

          {/* Right Action Buttons: Camera Toggle + Jump + Big Shoot */}
          <div className="pointer-events-auto flex flex-col items-end gap-2 shrink-0">
            {!hud.inVr && (
              <button
                type="button"
                onTouchStart={(e) => {
                  e.preventDefault();
                  onToggleCameraMode();
                }}
                onClick={onToggleCameraMode}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0f1940] active:bg-[#192963] border border-cyan-400/65 font-display font-bold text-[14px] text-white shadow-lg whitespace-nowrap"
                aria-label="Tukar Kamera"
              >
                <Eye className="w-4 h-4 text-cyan-300 shrink-0" />
                <span>{hud.cameraMode === 'first-person' ? 'FIRST PERSON' : 'THIRD PERSON'}</span>
              </button>
            )}
            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                onMobileJump();
              }}
              onClick={onMobileJump}
              className="px-4 py-2.5 rounded-xl bg-purple-600 active:bg-purple-500 border border-purple-300/65 font-display font-bold text-[16px] text-white shadow-lg whitespace-nowrap"
            >
              LOMPAT
            </button>
            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                onMobileShoot();
              }}
              onClick={onMobileShoot}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 active:scale-95 border-4 border-white font-display font-extrabold text-[18px] text-slate-950 shadow-xl"
            >
              TEMBAK
            </button>
          </div>
        </div>
      )}

      {/* Clear Bottom Controls Hint on Desktop */}
      {!mobileControlsOpen && hud.phase === 'playing' && (
        <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-2.5 bg-[#08112e]/90 border border-white/15 rounded-xl px-4 py-1.5 text-[14px] sm:text-[16px] font-semibold text-white shadow-lg">
          <span>WASD: Gerak</span>
          <span aria-hidden="true">·</span>
          <span>Space: Lompat</span>
          <span aria-hidden="true">·</span>
          <span>Shift: Lari</span>
          <span aria-hidden="true">·</span>
          <span>V: Kamera</span>
          <span aria-hidden="true">·</span>
          {!hud.pointerLocked ? (
            <button
              type="button"
              onClick={onRequestPointerLock}
              className="text-cyan-300 hover:text-cyan-200 font-bold underline underline-offset-4 cursor-pointer"
            >
              Klik di arena untuk kunci sasaran tetikus & tembak
            </button>
          ) : (
            <span className="text-cyan-300 font-bold">
              Klik Kiri: Tembak · Esc: Jeda
            </span>
          )}
        </div>
      )}
    </div>
  );
}
