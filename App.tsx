
import React, { useState, useRef, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import Login from './components/Login.tsx';
import Logo from './components/Logo.tsx'; // Fixed: Missing Logo import
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

  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Reconhecimento de voz não suportado neste navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result) => result.transcript)
        .join('');
      setQuery(transcript);

      if (event.results[0].isFinal) {
        setTimeout(() => handleSearch(), 800);
      }
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
    } catch (error) {
      console.error("Search failed:", error);
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
      finalContent = `Referência: ${result.verse}. 
      No contexto da época: ${result.context}. 
      Análise detalhada: ${result.historicalAnalysis}. 
      Síntese teológica: ${result.theologicalInsights}`;
    }

    if (finalContent) {
      setIsReading(true);
      const control = await playAudio(finalContent, selectedVoice, playbackSpeed, selectedLanguage);
      if (control) activeAudioRef.current = control;
      else setIsReading(false);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
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
      onInstall={handleInstallClick}
    >
      {activeTab === 'studies' ? (
        <div className="space-y-8 animate-in slide-in-from-right duration-500">
          <section className="w-full">
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Versículo, local ou tema histórico..."
                className="w-full glass bg-white/5 border-white/10 text-white rounded-2xl md:rounded-full py-5 px-8 md:px-10 text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-white/20 shadow-2xl pr-32 md:pr-48"
              />
              <div className="absolute right-2.5 top-2.5 bottom-2.5 flex gap-2">
                <button 
                  type="button"
                  onClick={handleVoiceSearch}
                  className={`flex items-center justify-center w-12 rounded-xl md:rounded-full transition-all ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30' : 'bg-white/5 text-emerald-400/60 hover:text-emerald-400'}`}
                  title="Busca por voz"
                >
                  <i className={`fas ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`}></i>
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-indigo-950 font-black px-6 md:px-10 rounded-xl md:rounded-full transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg active:scale-95"
                >
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-feather-pointed"></i>}
                  <span className="hidden sm:inline uppercase tracking-widest text-[10px] font-bold">Analisar</span>
                </button>
              </div>
            </form>
          </section>

          {loading && (
            <div className="glass p-16 rounded-[2.5rem] flex flex-col items-center justify-center space-y-4 animate-pulse">
              <div className="w-12 h-12 border-4 border-emerald-500/10 border-t-emerald-400 rounded-full animate-spin"></div>
              <p className="text-white/40 font-serif italic text-lg">Consultando arquivos gramático-históricos...</p>
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
                    <div className="rounded-[2.5rem] overflow-hidden glass h-64 md:h-96 shadow-2xl border border-white/5 group">
                      <img src={imageUrl} alt="Cena Histórica" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-1000" />
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
                          <i className="fas fa-landmark text-emerald-500/30"></i> Contexto da Época
                        </h3>
                        <p className="text-white/60 leading-relaxed text-sm">{result.context}</p>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white/90 flex items-center gap-2 serif">
                          <i className="fas fa-scroll text-emerald-500/30"></i> Filologia & Termos
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
                      <h3 className="text-xl font-bold text-white/90 serif">Análise Gramático-Histórica</h3>
                      <p className="text-white/50 leading-relaxed text-sm italic font-light">{result.historicalAnalysis}</p>
                    </div>

                    <div className="glass bg-emerald-500/5 p-10 rounded-[2.5rem] border border-emerald-500/10 shadow-inner">
                       <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2 serif">
                         <i className="fas fa-lightbulb"></i> Síntese Teológica
                       </h3>
                       <p className="text-white/80 leading-relaxed text-base">{result.theologicalInsights}</p>
                    </div>

                    {/* Fixed: Mandatory listing of grounding sources from Search results */}
                    {result.sources && result.sources.length > 0 && (
                      <div className="space-y-4 pt-8 border-t border-white/5">
                        <h3 className="text-xl font-bold text-white/90 serif flex items-center gap-2">
                          <i className="fas fa-link text-emerald-500/30"></i> Fontes & Referências
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {result.sources.map((source, idx) => (
                            <a 
                              key={idx} 
                              href={source.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="glass bg-white/5 px-4 py-2 rounded-full text-[10px] text-emerald-400/80 hover:bg-emerald-500/10 transition-all border border-white/5"
                            >
                              {source.title || 'Ver fonte'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <aside className="space-y-8">
                  <div className="glass p-8 rounded-[2rem] border border-emerald-500/5 bg-emerald-950/10">
                    <h3 className="text-[10px] font-bold text-emerald-400/60 mb-4 flex items-center gap-2 uppercase tracking-[0.3em]">
                      <i className="fas fa-circle-info"></i> Guia de Leitura
                    </h3>
                    <p className="text-white/40 text-xs leading-relaxed">
                      Selecione trechos específicos do texto para narração dedicada ou use o controle superior para ouvir o estudo completo.
                    </p>
                  </div>
                  
                  <div className="glass p-8 rounded-[2rem] border border-white/5 text-center">
                    <Logo className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-[9px] text-white/20 uppercase tracking-widest">Exegesis Verificada v2.4</p>
                  </div>
                </aside>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="glass p-20 rounded-[3rem] text-center space-y-8 border border-white/5 bg-gradient-to-br from-indigo-950/10 to-emerald-950/10">
              <i className="fas fa-feather-pointed text-8xl text-emerald-500/5"></i>
              <div className="space-y-4">
                <h2 className="text-4xl font-serif text-white/70">Mesa de Estudos</h2>
                <p className="text-white/20 text-xs max-w-lg mx-auto uppercase tracking-[0.4em] leading-relaxed">Inicie sua pesquisa bíblica com o rigor da tradição reformada.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-left duration-500">
          <div className="flex justify-between items-center px-4">
             <h2 className="text-2xl font-bold text-white/80 serif">Arquivo Histórico</h2>
             <span className="text-[10px] text-emerald-400/40 uppercase tracking-[0.4em]">{history.length} Estudos Salvos</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.length === 0 ? (
              <div className="col-span-full glass p-24 rounded-[3rem] text-center border border-white/5 opacity-50">
                <p className="text-white/20 uppercase tracking-[0.3em] text-xs">Seu arquivo pessoal está vazio.</p>
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
                  className="glass p-8 rounded-[2.5rem] border border-white/5 hover:bg-emerald-500/5 transition-all group flex flex-col justify-between cursor-pointer"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] text-white/20 font-mono tracking-tighter">{new Date(item.timestamp).toLocaleString()}</span>
                      <i className="fas fa-scroll text-emerald-500/10 group-hover:text-emerald-500/40 transition-colors"></i>
                    </div>
                    <h3 className="text-emerald-300 font-bold text-xl line-clamp-2 serif">{item.query}</h3>
                    <p className="text-white/30 text-[11px] line-clamp-3 leading-relaxed italic">{item.result.theologicalInsights}</p>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold group-hover:text-emerald-400 transition-colors">Reabrir</span>
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
