import { Home, Play, RotateCcw } from 'lucide-react';

interface PauseModalProps {
  score: number;
  questionNumber: number;
  totalQuestions: number;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export function PauseModal({
  score,
  questionNumber,
  totalQuestions,
  onResume,
  onRestart,
  onMainMenu,
}: PauseModalProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#050817]/82 overflow-y-auto">
      <div className="w-full max-w-md bg-[#08112e] border border-cyan-400/50 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 text-center my-auto">
        <div className="space-y-1.5">
          <div className="text-[16px] sm:text-[18px] font-bold text-cyan-300 tabular-nums">
            Soalan {questionNumber}/{totalQuestions} · Skor {score}/70
          </div>
          <h2 className="font-display font-extrabold text-[26px] sm:text-[32px] text-white leading-tight">
            Permainan Dijeda
          </h2>
          <p className="text-[16px] sm:text-[18px] font-semibold text-slate-200">
            Berehat sebentar atau teruskan cabaran peribahasa anda.
          </p>
        </div>

        <div className="bg-[#101c48] border border-white/15 rounded-xl p-4 text-left text-[15px] sm:text-[18px] font-semibold text-white space-y-1.5 leading-snug">
          <div className="font-display font-bold text-[18px] sm:text-[20px] text-cyan-300 mb-1">
            Peringatan Kawalan:
          </div>
          <div>W / A / S / D : Bergerak di dalam arena</div>
          <div>Tetikus & Klik Kiri : Hala & tembak sasaran</div>
          <div>Space : Lompat · Shift : Lari · V : Kamera</div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-display font-extrabold text-[18px] sm:text-[20px] cursor-pointer whitespace-nowrap"
          >
            <Play className="w-5 h-5 fill-current shrink-0" />
            <span>Sambung Bermain</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#132052] hover:bg-[#1a2b6d] border border-white/20 text-white font-display font-bold text-[18px] sm:text-[20px] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-5 h-5 shrink-0" />
            <span>Mula Semula</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0c163a] hover:bg-[#152459] border border-white/15 text-slate-100 font-display font-bold text-[18px] sm:text-[20px] cursor-pointer whitespace-nowrap"
          >
            <Home className="w-5 h-5 shrink-0" />
            <span>Menu Utama</span>
          </button>
        </div>
      </div>
    </div>
  );
}
