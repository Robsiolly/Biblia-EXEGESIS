
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
    <div className="glass p-5 rounded-3xl flex flex-wrap items-center gap-8 border border-white/10 shadow-2xl animate-in slide-in-from-top-4 duration-500 backdrop-blur-xl">
      {/* Play/Stop Button */}
      <button
        onClick={onTogglePlay}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
          isPlaying 
            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
            : 'bg-amber-500 text-white border border-amber-400/50 shadow-amber-500/30'
        } hover:scale-105 active:scale-95`}
      >
        <i className={`fas ${isPlaying ? 'fa-stop text-xl' : 'fa-play text-xl ml-1'}`}></i>
      </button>

      {/* Language Selector */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-1">
          <i className="fas fa-globe"></i> Idioma
        </label>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="bg-transparent text-white/90 text-sm focus:outline-none cursor-pointer hover:text-amber-400 transition-colors font-medium outline-none"
        >
          <option value="Português" className="bg-[#16213e]">Português</option>
          <option value="Inglês" className="bg-[#16213e]">Inglês</option>
          <option value="Espanhol" className="bg-[#16213e]">Espanhol</option>
          <option value="Hebreu" className="bg-[#16213e]">Hebreu</option>
          <option value="Grego" className="bg-[#16213e]">Grego</option>
        </select>
      </div>

      {/* Voice/Gender Selector */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-1">
          <i className="fas fa-user-circle"></i> Voz & Gênero
        </label>
        <select
          value={voice}
          onChange={(e) => onVoiceChange(e.target.value)}
          className="bg-transparent text-white/90 text-sm focus:outline-none cursor-pointer hover:text-amber-400 transition-colors font-medium outline-none"
        >
          <optgroup label="Masculino" className="bg-[#16213e] text-amber-400/80">
            <option value="Kore" className="bg-[#16213e]">Estevão (Nativa)</option>
            <option value="Charon" className="bg-[#16213e]">Bento (Profunda)</option>
          </optgroup>
          <optgroup label="Feminino" className="bg-[#16213e] text-amber-400/80">
            <option value="Puck" className="bg-[#16213e]">Sara (Suave)</option>
            <option value="Zephyr" className="bg-[#16213e]">Aurora (Clara)</option>
          </optgroup>
        </select>
      </div>

      {/* Speed Slider */}
      <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
        <div className="flex justify-between items-center">
          <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-1">
            <i className="fas fa-gauge-high"></i> Cadência
          </label>
          <span className="text-[10px] text-amber-400 font-mono font-bold">{speed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-all"
        />
      </div>
    </div>
  );
};

export default AudioControls;
