
import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = "w-16 h-16" }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
        {/* Aura de Luz Verde Bebê */}
        <defs>
          <radialGradient id="greenGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50%" cy="50%" r="45" fill="url(#greenGradient)" className="animate-pulse" />
        
        {/* Ícone do Livro/Pergaminho em Verde Suave */}
        <path 
          d="M25 30C25 27.2386 27.2386 25 30 25H50V75H30C27.2386 75 25 72.7614 25 70V30Z" 
          fill="none" 
          stroke="#34d399" 
          strokeWidth="2.5" 
          className="opacity-90"
        />
        <path 
          d="M75 30C75 27.2386 72.7614 25 70 25H50V75H70C72.7614 75 75 72.7614 75 70V30Z" 
          fill="none" 
          stroke="#34d399" 
          strokeWidth="2.5" 
          className="opacity-90"
        />
        <line x1="50" y1="25" x2="50" y2="75" stroke="#34d399" strokeWidth="2" opacity="0.5" />
        
        {/* Linhas de Texto Simbólicas */}
        <line x1="32" y1="35" x2="43" y2="35" stroke="#34d399" strokeWidth="1.5" opacity="0.6" />
        <line x1="32" y1="45" x2="43" y2="45" stroke="#34d399" strokeWidth="1.5" opacity="0.6" />
        <line x1="32" y1="55" x2="43" y2="55" stroke="#34d399" strokeWidth="1.5" opacity="0.6" />
        
        <line x1="57" y1="35" x2="68" y2="35" stroke="#34d399" strokeWidth="1.5" opacity="0.6" />
        <line x1="57" y1="45" x2="68" y2="45" stroke="#34d399" strokeWidth="1.5" opacity="0.6" />
        <line x1="57" y1="55" x2="68" y2="55" stroke="#34d399" strokeWidth="1.5" opacity="0.6" />
      </svg>
    </div>
  );
};

export default Logo;