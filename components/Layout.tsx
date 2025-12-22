
import React from 'react';
import Logo from './Logo.tsx';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'studies' | 'history';
  onTabChange: (tab: 'studies' | 'history') => void;
  userName: string;
  onLogout: () => void;
  deferredPrompt: any;
  onInstall: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  userName, 
  onLogout,
  deferredPrompt,
  onInstall
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 relative overflow-x-hidden">
      <header className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-12 glass p-6 rounded-3xl md:rounded-full animate-float gap-6 bg-gradient-to-r from-indigo-950/40 to-purple-950/40">
        <div className="flex items-center gap-4">
          <Logo className="w-12 h-12" />
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-white/90 serif">EXEGESIS</h1>
            <p className="text-[10px] text-emerald-400/60 uppercase tracking-[0.2em]">{userName}</p>
          </div>
        </div>

        <nav className="flex items-center gap-6 bg-white/5 p-1 rounded-full border border-white/5">
          <button 
            onClick={() => onTabChange('studies')}
            className={`px-8 py-2.5 rounded-full text-xs font-bold transition-all uppercase tracking-widest ${activeTab === 'studies' ? 'bg-emerald-500 text-indigo-950 shadow-lg' : 'text-white/40 hover:text-emerald-400/60'}`}
          >
            Estudos
          </button>
          <button 
            onClick={() => onTabChange('history')}
            className={`px-8 py-2.5 rounded-full text-xs font-bold transition-all uppercase tracking-widest ${activeTab === 'history' ? 'bg-emerald-500 text-indigo-950 shadow-lg' : 'text-white/40 hover:text-emerald-400/60'}`}
          >
            Histórico
          </button>
        </nav>

        <div className="flex items-center gap-4">
          {deferredPrompt && (
            <button 
              onClick={onInstall}
              className="text-emerald-400 hover:text-emerald-300 transition-colors p-3"
              title="Instalar App"
            >
              <i className="fas fa-download"></i>
            </button>
          )}
          <button 
            onClick={onLogout}
            className="text-white/20 hover:text-red-400 transition-colors uppercase tracking-widest text-[10px] flex items-center gap-2 px-4"
          >
            Sair <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </header>

      <main className="w-full max-w-6xl flex-1 flex flex-col gap-8 transition-all duration-500">
        {children}
      </main>

      <footer className="w-full max-w-6xl mt-12 py-8 border-t border-white/5 text-center text-white/10 text-[10px] uppercase tracking-widest">
        &copy; 2024 EXEGESIS - Biblioteca de Alta Erudição
      </footer>
    </div>
  );
};

export default Layout;
