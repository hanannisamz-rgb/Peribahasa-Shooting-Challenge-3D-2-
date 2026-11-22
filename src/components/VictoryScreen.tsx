import { useEffect, useRef } from 'react';
import { Award, Home, RotateCcw, Star, Trophy } from 'lucide-react';
import { ACHIEVEMENT_BADGES, type AchievementBadge } from '../data/questions';

interface VictoryScreenProps {
  score: number;
  maxScore: number;
  totalQuestions: number;
  stars: number;
  unlockedBadges: AchievementBadge[];
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export function VictoryScreen({
  score,
  maxScore,
  totalQuestions,
  stars,
  unlockedBadges,
  onPlayAgain,
  onMainMenu,
}: VictoryScreenProps) {
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#22d3ee', '#a855f7', '#38bdf8', '#fbbf24', '#ffffff', '#34d399'];
    const pieces = Array.from({ length: 110 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: 7 + Math.random() * 7,
      h: 5 + Math.random() * 6,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 2.2 + Math.random() * 3.5,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.14,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let animId = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const displayBadges =
    unlockedBadges.length > 0 ? unlockedBadges : ACHIEVEMENT_BADGES;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-gradient-to-b from-[#060919]/60 via-[#070d28]/72 to-[#060919]/88 overflow-y-auto">
      <canvas
        ref={confettiCanvasRef}
        className="fixed inset-0 pointer-events-none z-0"
      />

      <div className="relative z-10 w-full max-w-2xl bg-[#08112e]/95 border border-cyan-400/55 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 text-center my-auto">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-cyan-400 text-slate-950 shadow-lg mx-auto">
          <Trophy className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <div className="text-[14px] sm:text-[16px] font-bold text-cyan-300">
            Kesemua 7 Tahap Diselesaikan
          </div>
          <h1 className="font-display font-extrabold text-[28px] sm:text-[34px] lg:text-[36px] text-white tracking-tight leading-tight">
            Tahniah, Wira Peribahasa!
          </h1>
          <p className="text-[16px] sm:text-[18px] font-semibold text-slate-100 max-w-xl mx-auto leading-relaxed">
            Hebat! Anda berjaya menewaskan semua sasaran peribahasa dengan ketepatan dan keberanian.
          </p>
        </div>

        {/* Score & Stars KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
          <div className="bg-[#101c48] border border-cyan-400/40 rounded-xl p-3.5">
            <div className="text-[14px] sm:text-[15px] font-bold text-slate-200">
              Skor Akhir
            </div>
            <div className="font-display font-extrabold text-[24px] sm:text-[28px] text-cyan-300 mt-0.5">
              {score}/{maxScore}
            </div>
          </div>

          <div className="bg-[#101c48] border border-purple-400/40 rounded-xl p-3.5">
            <div className="text-[14px] sm:text-[15px] font-bold text-slate-200">
              Soalan Selesai
            </div>
            <div className="font-display font-extrabold text-[24px] sm:text-[28px] text-white mt-0.5">
              {totalQuestions}/{totalQuestions}
            </div>
          </div>

          <div className="bg-[#101c48] border border-amber-400/40 rounded-xl p-3.5">
            <div className="text-[14px] sm:text-[15px] font-bold text-slate-200">
              Jumlah Bintang
            </div>
            <div className="font-display font-extrabold text-[24px] sm:text-[28px] text-amber-300 mt-0.5 flex items-center justify-center gap-1.5">
              <span>{stars}</span>
              <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
            </div>
          </div>
        </div>

        {/* Achievement Badges */}
        <div className="space-y-2.5 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[15px] sm:text-[16px] font-bold">
            <span className="flex items-center gap-2 text-white font-display">
              <Award className="w-5 h-5 text-amber-400 shrink-0" />
              Lencana Pencapaian Diperoleh
            </span>
            <span className="font-display text-cyan-300 tabular-nums">{displayBadges.length} Lencana</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {displayBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-start gap-2.5 bg-[#101c48] border border-white/10 rounded-xl p-3"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${badge.accentColor}28`, color: badge.accentColor }}
                >
                  <Award className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-[15px] sm:text-[16px] text-white leading-snug">
                    {badge.name}
                  </div>
                  <div className="text-[14px] sm:text-[15px] font-medium text-slate-200 leading-snug mt-0.5">
                    {badge.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-display font-extrabold text-[18px] sm:text-[22px] shadow-lg cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-5 h-5 shrink-0" />
            <span>Main Semula</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#132052] hover:bg-[#1a2b6d] border border-white/20 text-white font-display font-bold text-[18px] sm:text-[22px] cursor-pointer whitespace-nowrap"
          >
            <Home className="w-5 h-5 shrink-0" />
            <span>Menu Utama</span>
          </button>
        </div>
      </div>
    </div>
  );
}
