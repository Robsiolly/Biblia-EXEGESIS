
import React from 'react';

interface AudioControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  voice: string;
  onVoiceChange: (voice: string) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
}

const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  onTogglePlay,
  voice,
  onVoiceChange,
  speed,
  onSpeedChange,
  language,
  onLanguageChange
}) => {
  return (
    <div className="glass p-3 md:p-5 rounded-2xl md:rounded-3xl flex flex-col md:flex-row items-center gap-4 md:gap-8 border border-white/10 shadow-2xl animate-in slide-in-from-top-4 duration-500 backdrop-blur-xl">
      {/* Play/Stop and Main Selects Container */}
      <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto justify-center">
        <button
          onClick={onTogglePlay}
          className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shadow-lg flex-shrink-0 ${
            isPlaying 
              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
              : 'bg-emerald-500 text-indigo-950 border border-emerald-400/50 shadow-emerald-500/30'
          } hover:scale-105 active:scale-95`}
        >
          <i className={`fas ${isPlaying ? 'fa-stop text-lg' : 'fa-play text-lg ml-1'}`}></i>
        </button>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-1">
            <i className="fas fa-globe text-[8px]"></i> Idioma
          </label>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="bg-transparent text-white/90 text-[11px] md:text-sm focus:outline-none cursor-pointer hover:text-emerald-400 transition-colors font-medium outline-none"
          >
            <option value="Português" className="bg-[#1e1b4b]">Português</option>
            <option value="Inglês" className="bg-[#1e1b4b]">Inglês</option>
            <option value="Hebreu" className="bg-[#1e1b4b]">Hebreu</option>
            <option value="Grego" className="bg-[#1e1b4b]">Grego</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-1">
            <i className="fas fa-user-circle text-[8px]"></i> Voz / Gênero
          </label>
          <select
            value={voice}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="bg-transparent text-white/90 text-[11px] md:text-sm focus:outline-none cursor-pointer hover:text-emerald-400 transition-colors font-medium outline-none"
          >
            <optgroup label="Masculino" className="bg-[#1e1b4b] text-emerald-400/80">
              <option value="Kore" className="bg-[#1e1b4b]">Estevão (Sóbrio)</option>
              <option value="Charon" className="bg-[#1e1b4b]">Bento (Profundo)</option>
            </optgroup>
            <optgroup label="Feminino" className="bg-[#1e1b4b] text-emerald-400/80">
              <option value="Puck" className="bg-[#1e1b4b]">Sara (Narrativa)</option>
              <option value="Zephyr" className="bg-[#1e1b4b]">Aurora (Clara)</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Speed Slider - Aumentado para até 2.5x para maior agilidade se desejado */}
      <div className="flex flex-col gap-1 w-full md:flex-1 md:min-w-[140px]">
        <div className="flex justify-between items-center">
          <label className="text-[9px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-1">
            <i className="fas fa-gauge-high text-[8px]"></i> Cadência
          </label>
          <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-tighter">{speed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.5"
          step="0.1"
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
        />
      </div>
    </div>
  );
};

export default AudioControls;
