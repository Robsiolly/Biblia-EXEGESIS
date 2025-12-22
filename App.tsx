
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
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'studies' | 'history'>('studies');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExegesisResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isListening, setIsListening] = useState(false);

  // Audio states
  const [isReading, setIsReading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [selectedLanguage, setSelectedLanguage] = useState('Português');
  const activeAudioRef = useRef<AudioControl | null>(null);
  const [selectedText, setSelectedText] = useState('');

  // PWA Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
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
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      } else {
        setHistory([]);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && history.length > 0) {
      localStorage.setItem(`exegesis_history_${user.id}`, JSON.stringify(history));
    }
  }, [history, user]);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        setSelectedText(selection.toString());
      } else {
        setSelectedText('');
      }
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition;
    if (!SpeechRecognition) {
      alert("Reconhecimento de voz não suportado.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      handleSearch();
    };
    recognition.start();
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    if (!hasApiKey && window.aistudio) {
      await handleSelectKey();
    }

    if (activeAudioRef.current) {
      activeAudioRef.current.stop();
      setIsReading(false);
    }

    setLoading(true);
    setResult(null);
    setImageUrl(null);

    try {
      const exegesisData = await getExegesis(query);
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
      setHistory(prev => [newItem, ...prev]);
    } catch (error: any) {
      console.error("Search failed:", error);
      if (error.message?.includes("Requested entity was not found") && window.aistudio) {
        setHasApiKey(false);
        handleSelectKey();
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

    let finalContent = "";
    if (textToRead) {
      finalContent = textToRead;
    } else if (selectedText) {
      finalContent = selectedText;
    } else if (result) {
      finalContent = `Texto: ${result.verse}. Contexto: ${result.context}. Análise: ${result.historicalAnalysis}. Aplicação: ${result.theologicalInsights}`;
    }

    if (finalContent) {
      setIsReading(true);
      const control = await playAudio(finalContent, selectedVoice, playbackSpeed, selectedLanguage);
      if (control) activeAudioRef.current = control;
      else setIsReading(false);
    }
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab} 
      userName={user.name} 
      onLogout={() => setUser(null)}
      deferredPrompt={deferredPrompt}
      onInstall={() => deferredPrompt?.prompt()}
      hasApiKey={hasApiKey}
      onSelectKey={handleSelectKey}
    >
      {!hasApiKey && (
        <div className="mb-8 glass bg-amber-500/10 border-amber-500/30 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top duration-700">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 text-2xl">
              <i className="fas fa-key"></i>
            </div>
            <div>
              <h3 className="text-amber-400 font-bold serif text-xl">Chave de Acesso Necessária</h3>
              <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Para realizar buscas avançadas no Vercel, conecte seu projeto Google Cloud.</p>
            </div>
          </div>
          <button 
            onClick={handleSelectKey}
            className="bg-amber-500 hover:bg-amber-400 text-indigo-950 font-black px-8 py-4 rounded-full transition-all active:scale-95 text-xs uppercase tracking-widest"
          >
            Vincular API Key
          </button>
        </div>
      )}

      {activeTab === 'studies' ? (
        <div className="space-y-8 animate-in slide-in-from-right duration-500">
          <section className="w-full">
            <form onSubmit={handleSearch} className="relative group flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400/40 pointer-events-none">
                  <i className="fas fa-search"></i>
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Passagem, cultura ou evento bíblico..."
                  className="w-full glass bg-white/5 border-white/10 text-white rounded-2xl md:rounded-full py-5 pl-14 pr-14 md:pr-10 text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-white/20 shadow-2xl"
                />
                <button 
                  type="button"
                  onClick={handleVoiceSearch}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full transition-all ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30' : 'text-emerald-400/60 hover:text-emerald-400'}`}
                  title="Busca por voz"
                >
                  <i className={`fas ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`}></i>
                </button>
              </div>
              
              <button 
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-indigo-950 font-black px-10 py-5 sm:py-0 rounded-2xl md:rounded-full transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg active:scale-95 group overflow-hidden"
              >
                {loading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-feather-pointed group-hover:rotate-12 transition-transform"></i>
                )}
                <span className="uppercase tracking-[0.2em] text-xs font-black">Buscar Estudo</span>
              </button>
            </form>
          </section>

          {loading && (
            <div className="glass p-16 rounded-[2.5rem] flex flex-col items-center justify-center space-y-6 animate-pulse">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-400 rounded-full animate-spin"></div>
                <Logo className="absolute inset-0 w-8 h-8 m-auto opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-white/60 font-serif italic text-xl">Sincronizando Manuscritos...</p>
                <p className="text-white/20 text-[10px] uppercase tracking-[0.3em] mt-2">Ativando Modo de Raciocínio Profundo</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="sticky top-4 z-40 px-2 md:px-0">
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
                  {imageUrl && (
                    <div className="rounded-[2.5rem] overflow-hidden glass h-64 md:h-96 shadow-2xl border border-white/5 group relative">
                      <img src={imageUrl} alt="Cena Histórica" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-1000" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60"></div>
                    </div>
                  )}

                  <div className="glass p-8 md:p-14 rounded-[3rem] space-y-10 gloss-effect border border-white/5 shadow-2xl bg-gradient-to-br from-indigo-950/20 to-purple-950/20">
                    <div className="flex justify-between items-center border-b border-white/10 pb-8">
                      <h2 className="text-3xl md:text-5xl font-bold text-emerald-400 serif tracking-tight">{result.verse}</h2>
                      <button onClick={() => handleRead(result.verse)} className="p-4 glass rounded-full hover:bg-emerald-500/20 text-emerald-400 active:scale-90" title="Ler Referência"><i className="fas fa-volume-up"></i></button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white/90 flex items-center gap-2 serif">
                          <i className="fas fa-landmark text-emerald-500/30"></i> Panorama da Época
                        </h3>
                        <p className="text-white/60 leading-relaxed text-sm text-justify">{result.context}</p>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white/90 flex items-center gap-2 serif">
                          <i className="fas fa-scroll text-emerald-500/30"></i> Termos Críticos
                        </h3>
                        <div className="space-y-3">
                          {result.originalLanguages.map((lang, idx) => (
                            <div key={idx} className="glass bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-emerald-500/30 transition-all">
                              <div className="flex justify-between mb-1">
                                <span className="font-serif text-emerald-300 text-lg">{lang.term}</span>
                                <span className="text-[9px] text-white/20 italic uppercase tracking-widest">{lang.transliteration}</span>
                              </div>
                              <p className="text-[11px] text-white/40 leading-snug">{lang.meaning}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-8 border-t border-white/5">
                      <h3 className="text-xl font-bold text-white/90 serif">Exegese Gramático-Histórica</h3>
                      <p className="text-white/50 leading-relaxed text-sm italic font-light text-justify">{result.historicalAnalysis}</p>
                    </div>

                    <div className="glass bg-emerald-500/5 p-10 rounded-[2.5rem] border border-emerald-500/10 shadow-inner relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full"></div>
                       <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2 serif">
                         <i className="fas fa-lightbulb"></i> Conclusão Erudita
                       </h3>
                       <p className="text-white/80 leading-relaxed text-base relative z-10">{result.theologicalInsights}</p>
                    </div>

                    {result.sources && result.sources.length > 0 && (
                      <div className="space-y-4 pt-8 border-t border-white/5">
                        <h3 className="text-xl font-bold text-white/90 serif flex items-center gap-2">
                          <i className="fas fa-link text-emerald-500/30"></i> Grounding & Fontes
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {result.sources.map((source, idx) => (
                            <a 
                              key={idx} 
                              href={source.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="glass bg-white/5 px-4 py-2 rounded-full text-[10px] text-emerald-400/80 hover:bg-emerald-500/10 transition-all border border-white/5 flex items-center gap-2"
                            >
                              <i className="fas fa-external-link-alt text-[8px]"></i>
                              {source.title || 'Referência Externa'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <aside className="space-y-8">
                  <div className="glass p-8 rounded-[2rem] border border-emerald-500/5 bg-emerald-950/10 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
                    <h3 className="text-[10px] font-bold text-emerald-400/60 mb-4 flex items-center gap-2 uppercase tracking-[0.3em]">
                      <i className="fas fa-brain"></i> IA de Raciocínio
                    </h3>
                    <p className="text-white/40 text-xs leading-relaxed">
                      Esta análise foi processada com o Modo de Pensamento (Thinking Budget), garantindo que a IA consultasse múltiplas fontes históricas antes de concluir.
                    </p>
                  </div>
                  
                  <div className="glass p-8 rounded-[2rem] border border-white/5 text-center flex flex-col items-center">
                    <Logo className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-[9px] text-white/20 uppercase tracking-[0.4em] font-medium">Fides Quaerens Intellectum</p>
                  </div>
                </aside>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="glass p-24 rounded-[4rem] text-center space-y-8 border border-white/5 bg-gradient-to-br from-indigo-950/10 to-emerald-950/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/papyros.png')] opacity-5 pointer-events-none"></div>
              <i className="fas fa-feather-pointed text-8xl text-emerald-500/5 mb-4"></i>
              <div className="space-y-4 relative z-10">
                <h2 className="text-4xl font-serif text-white/70">Laboratório Exegético</h2>
                <p className="text-white/20 text-xs max-w-lg mx-auto uppercase tracking-[0.4em] leading-relaxed">Onde a tradição milenar encontra a inteligência de última geração.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-left duration-500">
          <div className="flex justify-between items-center px-4">
             <h2 className="text-2xl font-bold text-white/80 serif">Arquivo Histórico</h2>
             <span className="text-[10px] text-emerald-400/40 uppercase tracking-[0.4em]">{history.length} Registros</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.length === 0 ? (
              <div className="col-span-full glass p-24 rounded-[3rem] text-center border border-white/5 opacity-50">
                <p className="text-white/20 uppercase tracking-[0.3em] text-xs">Ainda não há registros nesta biblioteca.</p>
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => {
                    setResult(item.result);
                    setImageUrl(item.imageUrl || null);
                    setActiveTab('studies');
                    setQuery(item.query);
                  }}
                  className="glass p-8 rounded-[2.5rem] border border-white/5 hover:bg-emerald-500/5 transition-all group flex flex-col justify-between cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 -translate-y-12 translate-x-12 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all"></div>
                  <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] text-white/20 font-mono tracking-tighter">{new Date(item.timestamp).toLocaleDateString()}</span>
                      <i className="fas fa-scroll text-emerald-500/10 group-hover:text-emerald-500/40 transition-colors"></i>
                    </div>
                    <h3 className="text-emerald-300 font-bold text-xl line-clamp-2 serif leading-snug">{item.query}</h3>
                    <p className="text-white/30 text-[11px] line-clamp-3 leading-relaxed italic">{item.result.theologicalInsights}</p>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center relative z-10">
                    <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold group-hover:text-emerald-400 transition-colors">Retomar Estudo</span>
                    <i className="fas fa-arrow-right text-[10px] text-white/10 group-hover:translate-x-1 transition-transform"></i>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <VoiceInteraction />
    </Layout>
  );
};

export default App;
