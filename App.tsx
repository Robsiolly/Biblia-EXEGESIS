
import React, { useState, useRef, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import Login from './components/Login.tsx';
import Logo from './components/Logo.tsx';
import { getExegesis, generateHistoricalImage, playAudio, AudioControl } from './services/geminiService.ts';
import { ExegesisResult, HistoryItem, User } from './types.ts';
import VoiceInteraction from './components/VoiceInteraction.tsx';
import AudioControls from './components/AudioControls.tsx';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'studies' | 'history'>('studies');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExegesisResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [modelMode, setModelMode] = useState<'flash' | 'pro'>('flash');
  const [hasKey, setHasKey] = useState<boolean>(true);

  const [isReading, setIsReading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [selectedLanguage, setSelectedLanguage] = useState('Português');
  const activeAudioRef = useRef<AudioControl | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  useEffect(() => {
    if (user) {
      const savedHistory = localStorage.getItem(`exegesis_history_${user.id}`);
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    }
  }, [user]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      setApiError(null);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    if (activeAudioRef.current) {
      activeAudioRef.current.stop();
      setIsReading(false);
    }

    setLoading(true);
    setResult(null);
    setImageUrl(null);
    setApiError(null);

    try {
      const exegesisData = await getExegesis(query, modelMode);
      setResult(exegesisData);
      
      const img = await generateHistoricalImage(exegesisData.imagePrompt);
      setImageUrl(img);

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        query,
        timestamp: Date.now(),
        result: exegesisData,
        imageUrl: img || undefined
      };
      setHistory(prev => {
        const updated = [newItem, ...prev];
        if (user) localStorage.setItem(`exegesis_history_${user.id}`, JSON.stringify(updated));
        return updated;
      });
    } catch (error: any) {
      console.error("Erro na API:", error);
      const msg = error.message || "";
      
      if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
        if (modelMode === 'pro') {
          setApiError("A cota do modelo Pro acabou. Tente o 'Modo Grátis' (Flash) ou conecte uma chave pessoal.");
        } else {
          setApiError("Até o modelo gratuito está temporariamente sobrecarregado. Tente novamente em alguns minutos.");
        }
      } else {
        setApiError("Ocorreu um erro na conexão. Verifique sua chave ou tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRead = async () => {
    if (isReading) {
      activeAudioRef.current?.stop();
      setIsReading(false);
      return;
    }
    if (result) {
      const content = `${result.verse}. Contexto: ${result.context}. Aplicação: ${result.theologicalInsights}`;
      setIsReading(true);
      const control = await playAudio(content, selectedVoice);
      if (control) {
        activeAudioRef.current = control;
        activeAudioRef.current.setSpeed(playbackSpeed);
      } else {
        setIsReading(false);
      }
    }
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab} 
      userName={user.name} 
      onLogout={() => setUser(null)}
      deferredPrompt={deferredPrompt}
      onInstall={() => deferredPrompt?.prompt()}
    >
      {activeTab === 'studies' ? (
        <div className="space-y-8 animate-in slide-in-from-right duration-500">
          <section className="w-full space-y-4">
            {/* Model Selector Toggle */}
            <div className="flex justify-center">
              <div className="glass p-1 rounded-full flex gap-1 border border-white/5 bg-black/20">
                <button 
                  onClick={() => setModelMode('flash')}
                  className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${modelMode === 'flash' ? 'bg-emerald-500 text-indigo-950 shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                >
                  <i className="fas fa-bolt"></i> Versão Grátis
                </button>
                <button 
                  onClick={() => setModelMode('pro')}
                  className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${modelMode === 'pro' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-white/40 hover:text-white/60'}`}
                >
                  <i className="fas fa-gem"></i> Análise Pro
                </button>
              </div>
            </div>

            <form onSubmit={handleSearch} className="relative group flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400/40"></i>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Referência ou tema bíblico..."
                  className="w-full glass bg-white/5 border-white/10 text-white rounded-2xl md:rounded-full py-5 pl-14 pr-4 text-base focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-indigo-950 font-black px-10 py-5 rounded-2xl md:rounded-full transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-feather-pointed"></i>}
                <span className="uppercase tracking-widest text-xs">Analisar</span>
              </button>
            </form>
            
            <p className="text-center text-[9px] text-white/20 uppercase tracking-[0.2em]">
              {modelMode === 'flash' 
                ? "Usando Gemini Flash: Respostas instantâneas e maior cota gratuita." 
                : "Usando Gemini Pro: Deep reasoning teológico. Requer faturamento na chave."}
            </p>
          </section>

          {apiError && (
            <div className="glass bg-red-500/10 border-red-500/20 p-6 rounded-3xl flex flex-col gap-4 animate-in shake duration-500">
              <div className="flex items-center gap-4 text-red-400 text-sm">
                <i className="fas fa-exclamation-circle text-xl"></i>
                <span>{apiError}</span>
              </div>
              {apiError.includes("Pro") && (
                <div className="flex gap-2 pl-9">
                  <button 
                    onClick={() => { setModelMode('flash'); setApiError(null); }}
                    className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg border border-white/10 transition-all"
                  >
                    Usar Versão Grátis
                  </button>
                  <button 
                    onClick={handleSelectKey}
                    className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg border border-emerald-500/20 transition-all"
                  >
                    Mudar Chave de API
                  </button>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="glass p-20 rounded-[3rem] flex flex-col items-center justify-center space-y-6">
              <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-400 rounded-full animate-spin"></div>
              <p className="text-white/60 font-serif italic text-xl">Consultando os Registros Antigos...</p>
            </div>
          )}

          {result && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="sticky top-4 z-40">
                <AudioControls 
                  isPlaying={isReading}
                  onTogglePlay={handleRead}
                  voice={selectedVoice}
                  onVoiceChange={setSelectedVoice}
                  speed={playbackSpeed}
                  onSpeedChange={(s) => {
                    setPlaybackSpeed(s);
                    activeAudioRef.current?.setSpeed(s);
                  }}
                  language={selectedLanguage}
                  onLanguageChange={setSelectedLanguage}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="rounded-[2.5rem] overflow-hidden glass min-h-[16rem] md:min-h-[24rem] shadow-2xl relative border border-white/5 flex items-center justify-center bg-black/20">
                    {imageUrl ? (
                      <>
                        <img src={imageUrl} alt="Cena Histórica" className="w-full h-full object-cover opacity-90" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-emerald-500/20 text-center p-8">
                        <i className="fas fa-image text-4xl mb-4"></i>
                        <p className="text-[10px] uppercase tracking-widest">Reconstrução visual indisponível no momento.</p>
                      </div>
                    )}
                  </div>

                  <div className="glass p-8 md:p-14 rounded-[3rem] space-y-10 border border-white/5 shadow-2xl">
                    <h2 className="text-3xl md:text-5xl font-bold text-emerald-400 serif border-b border-white/10 pb-8">{result.verse}</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white/90 serif flex items-center gap-2">
                          <i className="fas fa-landmark text-emerald-500/40"></i> Contexto Histórico
                        </h3>
                        <p className="text-white/60 leading-relaxed text-sm text-justify">{result.context}</p>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white/90 serif flex items-center gap-2">
                          <i className="fas fa-scroll text-emerald-500/40"></i> Línguas Originais
                        </h3>
                        <div className="space-y-3">
                          {result.originalLanguages.map((lang, idx) => (
                            <div key={idx} className="glass bg-white/5 p-4 rounded-2xl border border-white/5">
                              <div className="flex justify-between mb-1">
                                <span className="font-serif text-emerald-300 text-lg">{lang.term}</span>
                                <span className="text-[9px] text-white/20 italic uppercase">{lang.transliteration}</span>
                              </div>
                              <p className="text-[11px] text-white/40">{lang.meaning}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-8 border-t border-white/5">
                      <h3 className="text-xl font-bold text-white/90 serif">Análise Exegética</h3>
                      <p className="text-white/50 leading-relaxed text-sm italic text-justify">{result.historicalAnalysis}</p>
                    </div>

                    <div className="glass bg-emerald-500/5 p-10 rounded-[2.5rem] border border-emerald-500/10">
                       <h3 className="text-xl font-bold text-emerald-400 mb-4 serif">Aplicação Teológica</h3>
                       <p className="text-white/80 leading-relaxed text-base">{result.theologicalInsights}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-left duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((item) => (
              <div 
                key={item.id} 
                onClick={() => {
                  setResult(item.result);
                  setImageUrl(item.imageUrl || null);
                  setActiveTab('studies');
                  setQuery(item.query);
                }}
                className="glass p-8 rounded-[2.5rem] border border-white/5 hover:bg-emerald-500/5 transition-all cursor-pointer group"
              >
                <h3 className="text-emerald-300 font-bold text-xl line-clamp-2 serif group-hover:text-emerald-200 transition-colors">{item.query}</h3>
                <p className="text-white/30 text-[11px] mt-4 italic">{new Date(item.timestamp).toLocaleDateString()}</p>
              </div>
            ))}
            {history.length === 0 && (
              <div className="col-span-full py-20 text-center text-white/20">
                <i className="fas fa-folder-open text-4xl mb-4"></i>
                <p className="uppercase tracking-widest text-xs">Nenhum estudo arquivado ainda.</p>
              </div>
            )}
          </div>
        </div>
      )}
      <VoiceInteraction />
    </Layout>
  );
};

export default App;
