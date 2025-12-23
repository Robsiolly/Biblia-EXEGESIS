
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

  const [isReading, setIsReading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [selectedLanguage, setSelectedLanguage] = useState('Português');
  const activeAudioRef = useRef<AudioControl | null>(null);

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
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      else setHistory([]);
    }
  }, [user]);

  useEffect(() => {
    if (user && history.length > 0) {
      localStorage.setItem(`exegesis_history_${user.id}`, JSON.stringify(history));
    }
  }, [history, user]);

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
      console.error("Erro:", error);
      alert(`Erro no processamento. Verifique sua chave de API ou conexão.`);
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
      const control = await playAudio(content, selectedVoice, playbackSpeed);
      if (control) {
        activeAudioRef.current = control;
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

          {loading && (
            <div className="glass p-20 rounded-[3rem] flex flex-col items-center justify-center space-y-6">
              <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-400 rounded-full animate-spin"></div>
              <p className="text-white/60 font-serif italic text-xl">Escavando Registros Arqueológicos...</p>
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
                  {/* Container de Imagem Melhorado */}
                  <div className="rounded-[2.5rem] overflow-hidden glass min-h-[16rem] md:min-h-[24rem] shadow-2xl relative border border-white/5 flex items-center justify-center bg-black/20">
                    {imageUrl ? (
                      <>
                        <img src={imageUrl} alt="Cena Histórica" className="w-full h-full object-cover opacity-90 transition-opacity duration-1000" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                        <div className="absolute bottom-6 left-8 text-[10px] text-white/40 uppercase tracking-[0.4em] flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                           Reconstrução Visual Gemini 2.5
                        </div>
                      </>
                    ) : imageError ? (
                      <div className="flex flex-col items-center justify-center text-white/20 p-8 text-center">
                        <i className="fas fa-image-slash text-4xl mb-4"></i>
                        <p className="text-[10px] uppercase tracking-widest">A política de segurança impediu a geração visual deste tema específico.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-emerald-500/20">
                        <i className="fas fa-paint-brush text-4xl animate-bounce mb-4"></i>
                        <p className="text-[10px] uppercase tracking-widest">Pintando Reconstrução Histórica...</p>
                      </div>
                    )}
                  </div>

                  <div className="glass p-8 md:p-14 rounded-[3rem] space-y-10 border border-white/5 shadow-2xl">
                    <div className="flex justify-between items-center border-b border-white/10 pb-8">
                      <h2 className="text-3xl md:text-5xl font-bold text-emerald-400 serif">{result.verse}</h2>
                      <button onClick={() => handleRead(result.verse)} className="p-4 glass rounded-full hover:bg-emerald-500/20 text-emerald-400">
                        <i className="fas fa-volume-up"></i>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white/90 serif flex items-center gap-2">
                          <i className="fas fa-landmark text-emerald-500/40"></i> Contexto Histórico
                        </h3>
                        <p className="text-white/60 leading-relaxed text-sm text-justify">{result.context}</p>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white/90 serif flex items-center gap-2">
                          <i className="fas fa-scroll text-emerald-500/40"></i> Análise de Originais
                        </h3>
                        <div className="space-y-3">
                          {result.originalLanguages.map((lang, idx) => (
                            <div key={idx} className="glass bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all">
                              <div className="flex justify-between mb-1">
                                <span className="font-serif text-emerald-300 text-lg">{lang.term}</span>
                                <span className="text-[9px] text-white/20 italic tracking-widest uppercase">{lang.transliteration}</span>
                              </div>
                              <p className="text-[11px] text-white/40">{lang.meaning}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-8 border-t border-white/5">
                      <h3 className="text-xl font-bold text-white/90 serif">Análise Exegética Acadêmica</h3>
                      <p className="text-white/50 leading-relaxed text-sm italic text-justify">{result.historicalAnalysis}</p>
                    </div>

                    <div className="glass bg-emerald-500/5 p-10 rounded-[2.5rem] border border-emerald-500/10">
                       <h3 className="text-xl font-bold text-emerald-400 mb-4 serif">Hermenêutica & Aplicação</h3>
                       <p className="text-white/80 leading-relaxed text-base">{result.theologicalInsights}</p>
                    </div>

                    {/* Seção de Fontes de Pesquisa */}
                    {result.sources && result.sources.length > 0 && (
                      <div className="space-y-4 pt-8 border-t border-white/5">
                        <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                          <i className="fas fa-link"></i> Fontes e Referências de Grounding
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {result.sources.map((source, idx) => (
                            <a 
                              key={idx} 
                              href={source.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] bg-white/5 hover:bg-emerald-500/20 border border-white/10 text-emerald-400 px-3 py-1.5 rounded-full transition-all flex items-center gap-2"
                            >
                              <i className="fas fa-external-link-alt text-[8px]"></i>
                              {source.title || 'Referência Acadêmica'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <aside className="space-y-8">
                  <div className="glass p-8 rounded-[2rem] border border-emerald-500/10">
                    <h3 className="text-[10px] font-bold text-emerald-400/60 mb-4 uppercase tracking-widest flex items-center gap-2">
                      <i className="fas fa-microchip"></i> Motor Inteligente
                    </h3>
                    <p className="text-white/40 text-xs leading-relaxed">Utilizando Gemini 3 Flash com Grounding de Busca Google para precisão factual histórica.</p>
                  </div>
                  
                  <div className="glass p-8 rounded-[2rem] border border-white/5">
                    <h4 className="text-[10px] font-bold text-white/30 mb-4 uppercase tracking-widest">Dica de Estudo</h4>
                    <p className="text-white/40 text-[11px] italic">"A exegese busca extrair o sentido original do texto dentro do seu habitat histórico-cultural."</p>
                  </div>
                </aside>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="glass p-24 rounded-[4rem] text-center space-y-8 border border-white/5">
              <i className="fas fa-book-bible text-8xl text-emerald-500/10"></i>
              <div className="space-y-4">
                <h2 className="text-4xl font-serif text-white/70">Mergulhe nas Escrituras</h2>
                <p className="text-white/20 text-xs max-w-lg mx-auto uppercase tracking-[0.4em]">Análise técnica de originais, contexto histórico e reconstrução visual.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-left duration-500">
          <div className="flex justify-between items-center px-4">
            <h2 className="text-2xl font-bold text-white/80 serif">Arquivo de Estudos</h2>
            <span className="text-[10px] text-white/20 uppercase tracking-widest">{history.length} Registros</span>
          </div>
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
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[9px] text-white/20">{new Date(item.timestamp).toLocaleDateString()}</span>
                  <i className="fas fa-scroll text-emerald-500/20 group-hover:text-emerald-400 transition-colors"></i>
                </div>
                <h3 className="text-emerald-300 font-bold text-xl line-clamp-2 serif">{item.query}</h3>
                <p className="text-white/30 text-[11px] line-clamp-2 mt-4 italic">{item.result.theologicalInsights}</p>
              </div>
            ))}
          </div>
          {history.length === 0 && (
            <div className="text-center py-20 text-white/10 uppercase tracking-widest text-xs">Nenhum estudo arquivado ainda.</div>
          )}
        </div>
      )}
      <VoiceInteraction />
    </Layout>
  );
};

export default App;
