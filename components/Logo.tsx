
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12" }) => {
  return (
    <div className={`relative ${className} group`}>
      {/* Glow Effect Background */}
      <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full group-hover:bg-emerald-500/40 transition-all duration-700 animate-pulse"></div>
      
      <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 w-full h-full drop-shadow-2xl"
      >
        <defs>
          <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="inner-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* External Scroll Shape */}
        <path 
          d="M20 25C20 25 35 15 50 15C65 15 80 25 80 25V75C80 75 65 65 50 65C35 65 20 75 20 75V25Z" 
          stroke="url(#logo-grad)" 
          strokeWidth="4" 
          strokeLinejoin="round"
          className="filter-none"
        />

        {/* Digital Pulse in Center */}
        <circle cx="50" cy="40" r="6" fill="#34d399" filter="url(#glow)">
          <animate 
            attributeName="r" 
            values="6;8;6" 
            dur="2s" 
            repeatCount="indefinite" 
          />
          <animate 
            attributeName="opacity" 
            values="0.5;1;0.5" 
            dur="2s" 
            repeatCount="indefinite" 
          />
        </circle>

        {/* Stylized Lines (Text/Data) */}
        <path d="M35 35H45" stroke="white" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />
        <path d="M55 35H65" stroke="white" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />
        <path d="M35 45H65" stroke="white" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />
        <path d="M35 55H55" stroke="white" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />

        {/* Gloss Overlay */}
        <path 
          d="M25 30C25 30 40 22 50 22C60 22 75 30 75 30" 
          stroke="url(#inner-grad)" 
          strokeWidth="1" 
          strokeLinecap="round" 
        />
      </svg>
    </div>
  );
};

export default Logo;
