
import React, { useState, useRef, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import Login from './components/Login.tsx';
import { getExegesis, generateHistoricalImage, playAudio, AudioControl } from './services/geminiService.ts';
import { ExegesisResult, HistoryItem, User } from './types.ts';
import VoiceInteraction from './components/VoiceInteraction.tsx';
import AudioControls from './components/AudioControls.tsx';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'studies' | 'history'>('studies');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<ExegesisResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Audio states
  const [isReading, setIsReading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [selectedLanguage, setSelectedLanguage] = useState('Português');
  const activeAudioRef = useRef<AudioControl | null>(null);
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      console.log('PWA instalado com sucesso');
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

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setTimeout(() => handleSearch(undefined, transcript), 500);
    };

    recognition.start();
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const finalQuery = overrideQuery || query;
    if (!finalQuery.trim()) return;

    if (activeAudioRef.current) activeAudioRef.current.stop();
    setIsReading(false);

    setLoading(true);
    setResult(null);
    setImageUrl(null);
    if (!overrideQuery) setQuery(finalQuery);

    try {
      const exegesisData = await getExegesis(finalQuery);
      setResult(exegesisData);
      
      const img = await generateHistoricalImage(exegesisData.imagePrompt);
      setImageUrl(img);

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        query: finalQuery,
        timestamp: Date.now(),
        result: exegesisData,
        imageUrl: img || undefined
      };
      
      setHistory(prev => [newItem, ...prev]);
    } catch (error) {
      console.error("Erro na análise:", error);
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
    if (textToRead) finalContent = textToRead;
    else if (selectedText) finalContent = selectedText;
    else if (result) finalContent = result.content;

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
                placeholder="Ex: Cafarnaum ou 'Passagem do Mar Vermelho'"
                className="w-full glass bg-white/5 border-white/10 text-white rounded-2xl md:rounded-full py-4 md:py-5 pl-6 pr-40 md:pl-8 md:pr-56 text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all shadow-2xl"
              />
              <div className="absolute right-2 top-2 bottom-2 flex gap-1 md:gap-2">
                <button 
                  type="button"
                  onClick={handleVoiceSearch}
                  title="Busca por voz"
                  className={`flex items-center justify-center w-10 md:w-12 h-full rounded-xl md:rounded-full transition-all ${isListening ? 'bg-red-500/40 text-red-200 animate-pulse' : 'bg-white/5 text-emerald-400 hover:bg-white/10'}`}
                >
                  <i className={`fas ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`}></i>
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-indigo-950 font-black px-4 md:px-10 rounded-xl md:rounded-full transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] flex items-center justify-center gap-2 active:scale-95 group/btn"
                >
                  {loading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <>
                      <i className="fas fa-magnifying-glass text-xs md:text-sm group-hover/btn:rotate-12 transition-transform"></i>
                      <span className="uppercase tracking-[0.2em] text-[10px] md:text-xs">Buscar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {loading && (
            <div className="glass p-12 md:p-16 rounded-3xl flex flex-col items-center justify-center space-y-4 animate-pulse mx-2">
              <div className="w-10 h-10 border-4 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin"></div>
              <p className="text-white/40 font-serif italic text-sm md:text-base text-center">Mapeando coordenadas e registros arqueológicos...</p>
            </div>
          )}

          {result && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="sticky top-4 z-40 px-2">
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-2">
                <div className="lg:col-span-2 space-y-8">
                  {imageUrl && (
                    <div className="rounded-3xl overflow-hidden glass h-56 md:h-[450px] shadow-2xl border border-white/5 group bg-black/40">
                      <img src={imageUrl} alt="Cena" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-1000" />
                    </div>
                  )}

                  <div className="glass p-6 md:p-14 rounded-[2rem] md:rounded-[3rem] space-y-8 gloss-effect border border-white/5 shadow-2xl bg-gradient-to-br from-indigo-950/20 to-purple-950/20">
                    <div className="flex justify-between items-center border-b border-white/5 pb-6">
                      <h2 className="text-2xl md:text-4xl font-bold text-emerald-300 serif">{result.verse}</h2>
                      <button onClick={() => handleRead(result.content)} className="p-3 glass rounded-full hover:bg-emerald-400/20 text-emerald-400 active:scale-90"><i className="fas fa-volume-up"></i></button>
                    </div>
                    
                    <div className="prose prose-invert max-w-none text-white/70 leading-relaxed text-sm md:text-base space-y-6">
                      {result.content.split('\n\n').map((para, i) => {
                        if (para.startsWith('#')) return <h3 key={i} className="text-xl md:text-2xl font-bold text-white/90 serif mt-8 mb-4">{para.replace(/#/g, '').trim()}</h3>;
                        return <p key={i}>{para}</p>;
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {result.locations.length > 0 && (
                    <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                        <i className="fas fa-map-location-dot"></i> Cartografia & Geografia
                      </h3>
                      <div className="space-y-2">
                        {result.locations.map((loc, idx) => (
                          <a 
                            key={idx} 
                            href={loc.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 glass bg-emerald-400/5 hover:bg-emerald-400/20 rounded-2xl border border-white/5 transition-all group"
                          >
                            <span className="text-xs text-white/80 font-medium truncate pr-2">{loc.title}</span>
                            <i className="fas fa-external-link-alt text-[10px] text-emerald-400/60 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i>
                          </a>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/20 italic text-center">Locais extraídos via Maps Grounding</p>
                    </div>
                  )}

                  <div className="glass p-6 rounded-3xl border border-white/5 bg-emerald-900/10">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400/60 mb-4">Anotações Arqueológicas</h3>
                    <p className="text-[11px] text-white/40 leading-relaxed italic">
                      Os dados geográficos apresentados são fundamentados em registros cartográficos modernos sincronizados com a cronologia histórica gramatical.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="glass p-12 md:p-20 rounded-[2rem] md:rounded-[3rem] text-center space-y-6 md:space-y-8 border border-white/5 bg-gradient-to-br from-indigo-950/20 to-purple-950/20 mx-2">
              <i className="fas fa-feather-pointed text-5xl md:text-7xl text-emerald-400/10"></i>
              <div className="space-y-2">
                <h2 className="text-xl md:text-4xl font-serif text-white/70">Mesa de Estudos</h2>
                <p className="text-white/20 text-[10px] md:text-sm max-w-lg mx-auto uppercase tracking-widest leading-relaxed">A profundidade do texto sagrado ao alcance da tecnologia gramático-histórica.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-left duration-500 px-2">
          <div className="flex justify-between items-center px-2">
             <h2 className="text-xl md:text-2xl font-bold text-white/80 serif">Arquivo de Estudos</h2>
             <span className="text-[9px] md:text-[10px] text-emerald-400/40 uppercase tracking-[0.3em]">{history.length} Registros</span>
          </div>

          {history.length === 0 ? (
            <div className="glass p-16 md:p-20 rounded-[2rem] md:rounded-[3rem] text-center border border-white/5 opacity-50">
              <i className="fas fa-folder-open text-4xl md:text-5xl mb-4 block"></i>
              <p className="text-white/30 uppercase tracking-widest text-[10px] md:text-xs">Seu histórico está vazio.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {history.map((item) => (
                <div 
                  key={item.id} 
                  className="glass p-5 md:p-6 rounded-2xl md:rounded-3xl border border-white/5 hover:bg-emerald-400/5 transition-all group flex flex-col justify-between"
                >
                  <div className="space-y-3 md:space-y-4">
                    {item.imageUrl && (
                      <div className="h-28 md:h-32 rounded-xl md:rounded-2xl overflow-hidden mb-3 md:mb-4 border border-white/10 bg-black/40">
                        <img src={item.imageUrl} alt="Estudo" className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" />
                      </div>
                    )}
                    <h3 className="text-emerald-300 font-bold text-base md:text-lg line-clamp-2">{item.query}</h3>
                    <p className="text-white/40 text-[10px] md:text-xs line-clamp-2">{item.result.verse}</p>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 md:mt-6 pt-3 md:pt-4 border-t border-white/5">
                    <span className="text-[9px] md:text-[10px] text-white/20">{new Date(item.timestamp).toLocaleDateString()}</span>
                    <button 
                      onClick={() => {
                        setResult(item.result);
                        setImageUrl(item.imageUrl || null);
                        setActiveTab('studies');
                        setQuery(item.query);
                      }}
                      className="text-[10px] md:text-xs text-emerald-400/60 hover:text-emerald-300 font-bold uppercase tracking-widest"
                    >
                      Revisitar <i className="fas fa-arrow-right ml-1"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <VoiceInteraction onPerformSearch={(q) => handleSearch(undefined, q)} />
    </Layout>
  );
};

export default App;
