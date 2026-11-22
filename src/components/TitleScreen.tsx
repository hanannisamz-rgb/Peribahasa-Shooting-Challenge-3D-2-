import {
  Gamepad2,
  Glasses,
  Music,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PROVERB_QUESTIONS } from '../data/questions';

interface TitleScreenProps {
  muted: boolean;
  musicMuted: boolean;
  vrSupported: boolean;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onStartGame: () => void;
  onEnterVr: () => void;
}

export function TitleScreen({
  muted,
  musicMuted,
  vrSupported,
  onToggleMute,
  onToggleMusic,
  onStartGame,
  onEnterVr,
}: TitleScreenProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between gap-4 p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-[#050817]/82 via-[#070d26]/70 to-[#050817]/92 overflow-y-auto">
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-[18px] sm:text-[20px] tracking-tight text-white">
            Arena Bahasa Melayu Tahun 4
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleMusic}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0b153a] border border-purple-400/50 text-[15px] sm:text-[18px] font-bold text-white hover:bg-[#162354] transition-colors cursor-pointer whitespace-nowrap"
            aria-label={musicMuted ? 'Buka Lagu Latar' : 'Matikan Lagu Latar'}
          >
            <Music className={`w-4 h-4 ${musicMuted ? 'text-slate-400' : 'text-purple-300'}`} />
            <span>{musicMuted ? 'Lagu Mati' : 'Lagu Hidup'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0b153a] border border-cyan-400/50 text-[15px] sm:text-[18px] font-bold text-white hover:bg-[#162354] transition-colors cursor-pointer whitespace-nowrap"
            aria-label={muted ? 'Buka Bunyi' : 'Senyapkan Bunyi'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
            <span>{muted ? 'Bunyi Mati' : 'Bunyi Hidup'}</span>
          </button>
        </div>
      </header>

      {/* Center Hero Panel */}
      <main className="max-w-6xl w-full mx-auto my-auto py-2 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-5 bg-[#08112e]/94 border border-cyan-400/45 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-wrap items-center gap-2 text-[14px] sm:text-[16px] font-bold text-cyan-300">
            <span>Bahasa Melayu Tahun 4</span>
            <span aria-hidden="true">·</span>
            <span>7 Tahap Cabaran</span>
            <span aria-hidden="true">·</span>
            <span>Arena 3D</span>
          </div>

          <h1
            className="font-display font-extrabold text-[28px] sm:text-[34px] lg:text-[38px] leading-[1.14] tracking-tight text-white"
            style={{ textWrap: 'balance' }}
          >
            Peribahasa Shooting Challenge 3D
          </h1>

          <p className="text-slate-100 text-[16px] sm:text-[18px] lg:text-[20px] leading-relaxed font-semibold">
            Masuki arena kota futuristik dengan peledak laser cahaya anda! Terokai gelanggang,
            halakan sasaran dengan tepat, dan tembak papan jawapan{' '}
            <strong className="text-cyan-300 font-extrabold">A</strong>,{' '}
            <strong className="text-amber-300 font-extrabold">B</strong> atau{' '}
            <strong className="text-purple-300 font-extrabold">C</strong> bagi kesemua 7 soalan
            peribahasa untuk bergelar <strong className="text-cyan-200 font-extrabold">Wira Peribahasa</strong>.
          </p>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onStartGame}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-display font-extrabold text-[18px] sm:text-[20px] lg:text-[22px] shadow-lg shadow-cyan-500/25 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-current shrink-0" />
              <span>Mula Bermain</span>
            </button>

            {vrSupported && (
              <button
                type="button"
                onClick={onEnterVr}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 border border-purple-300/50 text-white font-display font-bold text-[18px] sm:text-[20px] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Glasses className="w-5 h-5 shrink-0" />
                <span>Masuk Mod VR</span>
              </button>
            )}
          </div>

          {/* Safe for Kids Note */}
          <div className="flex items-start gap-2 text-[14px] sm:text-[16px] font-semibold text-slate-200 leading-snug pt-1">
            <ShieldCheck className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" />
            <span>
              Permainan pendidikan mesra murid: peledak laser cahaya dan sasaran hologram sahaja.
            </span>
          </div>
        </div>

        {/* Right Column: Controls & 7 Stages */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-[#08112e]/94 border border-purple-400/45 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 font-display font-extrabold text-[18px] sm:text-[20px] text-white">
              <Gamepad2 className="w-5 h-5 text-purple-300 shrink-0" />
              <span>Cara Bermain & Kawalan</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="bg-[#101c48] border border-white/10 rounded-xl p-3">
                <div className="font-display font-extrabold text-[16px] sm:text-[18px] text-cyan-300">W A S D</div>
                <div className="text-slate-100 font-semibold text-[14px] sm:text-[16px] leading-snug mt-0.5">
                  Gerak depan, belakang, kiri & kanan
                </div>
              </div>
              <div className="bg-[#101c48] border border-white/10 rounded-xl p-3">
                <div className="font-display font-extrabold text-[16px] sm:text-[18px] text-cyan-300">Tetikus / Sentuh</div>
                <div className="text-slate-100 font-semibold text-[14px] sm:text-[16px] leading-snug mt-0.5">
                  Halakan ke sasaran A, B atau C
                </div>
              </div>
              <div className="bg-[#101c48] border border-white/10 rounded-xl p-3">
                <div className="font-display font-extrabold text-[16px] sm:text-[18px] text-cyan-300">Klik Kiri</div>
                <div className="text-slate-100 font-semibold text-[14px] sm:text-[16px] leading-snug mt-0.5">
                  Tembak pancaran laser tenaga
                </div>
              </div>
              <div className="bg-[#101c48] border border-white/10 rounded-xl p-3">
                <div className="font-display font-extrabold text-[16px] sm:text-[18px] text-cyan-300">Space · Shift · V</div>
                <div className="text-slate-100 font-semibold text-[14px] sm:text-[16px] leading-snug mt-0.5">
                  Lompat, lari & tukar kamera
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#08112e]/94 border border-cyan-400/35 rounded-2xl p-5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display font-bold text-[16px] sm:text-[18px] text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
                7 Tahap Arena
              </span>
              <span className="font-display font-bold text-[14px] sm:text-[15px] text-cyan-300 tabular-nums">
                70 Mata Maksimum
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {PROVERB_QUESTIONS.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#101c48] border border-white/10 text-[14px] sm:text-[15px]"
                >
                  <span className="font-semibold text-white truncate">{q.stageName}</span>
                  <span className="font-display font-bold text-cyan-300 shrink-0 ml-2 tabular-nums">+10 Mata</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto text-center text-[14px] sm:text-[16px] font-semibold text-slate-200">
        Setiap jawapan betul memberikan 10 mata dan 1 bintang · Kumpul kesemua 5 lencana pencapaian
      </footer>
    </div>
  );
}
