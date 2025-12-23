
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
  const [imageError, setImageError] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
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
      else setHistory([]);
    }
  }, [user]);

  useEffect(() => {
    if (user && history.length > 0) {
      localStorage.setItem(`exegesis_history_${user.id}`, JSON.stringify(history));
    }
  }, [history, user]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      setApiError(null);
    }
  };

  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Navegador sem suporte a voz.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      setQuery(event.results[0][0].transcript);
    };
    recognition.start();
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
    setImageError(false);
    setApiError(null);

    try {
      const exegesisData = await getExegesis(query);
      setResult(exegesisData);
      
      const img = await generateHistoricalImage(exegesisData.imagePrompt);
      if (img) {
        setImageUrl(img);
      } else {
        setImageError(true);
      }

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        query,
        timestamp: Date.now(),
        result: exegesisData,
        imageUrl: img || undefined
      };
      setHistory(prev => [newItem, ...prev]);
    } catch (error: any) {
      console.error("Erro Capturado no UI:", error);
      setApiError(error.message);
      // Se a cota estourou ou a chave sumiu, forçamos o aviso de chave
      if (error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("not found")) {
        setHasKey(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRead = async (textToRead?: string) => {
    if (isReading) {
      activeAudioRef.current?.stop();
      setIsReading(false);
      return;
    }

    let content = textToRead;
    if (!content && result) {
      content = `${result.verse}. Contexto: ${result.context}. Aplicação: ${result.theologicalInsights}`;
    }

    if (content) {
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

  if (!hasKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a1a]">
        <div className="w-full max-w-lg glass p-10 md:p-16 rounded-[3rem] text-center space-y-8 animate-in zoom-in duration-500">
          <Logo className="w-20 h-20 mx-auto" />
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white serif">Chave de API Necessária</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Para garantir uma experiência de alta performance e sem limites de cota, você precisa conectar sua própria chave do Google Gemini.
            </p>
            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-[10px] text-emerald-400/60 uppercase tracking-widest">
              Recomendado: Chave de projeto com faturamento (Billing)
            </div>
          </div>
          <div className="space-y-4">
            <button 
              onClick={handleSelectKey}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-indigo-950 font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-900/20 uppercase tracking-[0.2em] text-xs"
            >
              Conectar Minha Chave
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-[10px] text-white/30 hover:text-white/50 uppercase tracking-widest transition-colors"
            >
              Saiba mais sobre faturamento e cotas <i className="fas fa-external-link-alt ml-1"></i>
            </a>
          </div>
        </div>
      </div>
    );
  }

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
          <section className="w-full">
            <form onSubmit={handleSearch} className="relative group flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400/40"></i>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Referência ou tema bíblico (ex: Mateus 5:1)..."
                  className="w-full glass bg-white/5 border-white/10 text-white rounded-2xl md:rounded-full py-5 pl-14 pr-14 text-base focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
                <button 
                  type="button"
                  onClick={handleVoiceSearch}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full transition-all ${isListening ? 'text-red-400 animate-pulse' : 'text-emerald-400/60'}`}
                >
                  <i className={`fas ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`}></i>
                </button>
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-indigo-950 font-black px-10 py-5 rounded-2xl md:rounded-full transition-all flex items-center justify-center gap-3"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-feather-pointed"></i>}
                <span className="uppercase tracking-widest text-xs">Exegese</span>
              </button>
            </form>
          </section>

          {apiError && (
            <div className="glass bg-red-500/10 border-red-500/20 p-8 rounded-[2.5rem] flex items-start gap-4 animate-in shake duration-500">
              <i className="fas fa-triangle-exclamation text-red-400 text-2xl mt-1"></i>
              <div className="space-y-2 flex-1">
                <h3 className="text-red-400 font-bold uppercase tracking-widest text-xs">Limite de Cota Atingido</h3>
                <p className="text-white/60 text-sm leading-relaxed">Sua chave atual esgotou os recursos permitidos pela Google para o modelo Pro.</p>
                <div className="pt-4">
                  <button 
                    onClick={handleSelectKey}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    Trocar Chave de API
                  </button>
                </div>
              </div>
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
                  onTogglePlay={() => handleRead()}
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
                        <p className="text-[10px] uppercase tracking-widest">A reconstrução visual está indisponível ou em processo.</p>
                      </div>
                    )}
                  </div>

                  <div className="glass p-8 md:p-14 rounded-[3rem] space-y-10 border border-white/5 shadow-2xl">
                    <div className="flex justify-between items-center border-b border-white/10 pb-8">
                      <h2 className="text-3xl md:text-5xl font-bold text-emerald-400 serif">{result.verse}</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white/90 serif flex items-center gap-2">
                          <i className="fas fa-landmark text-emerald-500/40"></i> Contexto da Época
                        </h3>
                        <p className="text-white/60 leading-relaxed text-sm text-justify">{result.context}</p>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white/90 serif flex items-center gap-2">
                          <i className="fas fa-scroll text-emerald-500/40"></i> Originais
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
                       <h3 className="text-xl font-bold text-emerald-400 mb-4 serif">Aplicação</h3>
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
                className="glass p-8 rounded-[2.5rem] border border-white/5 hover:bg-emerald-500/5 transition-all cursor-pointer"
              >
                <h3 className="text-emerald-300 font-bold text-xl line-clamp-2 serif">{item.query}</h3>
                <p className="text-white/30 text-[11px] mt-4 italic">{new Date(item.timestamp).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <VoiceInteraction />
    </Layout>
  );
};

export default App;
