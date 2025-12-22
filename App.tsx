
import React, { useState, useRef, useEffect } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import { getExegesis, generateHistoricalImage, playAudio, AudioControl } from './services/geminiService';
import { ExegesisResult, HistoryItem, User } from './types';
import VoiceInteraction from './components/VoiceInteraction';
import AudioControls from './components/AudioControls';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'studies' | 'history'>('studies');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExegesisResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Audio states
  const [isReading, setIsReading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [selectedLanguage, setSelectedLanguage] = useState('Português');
  const activeAudioRef = useRef<AudioControl | null>(null);
  const [selectedText, setSelectedText] = useState('');

  // Carrega histórico isolado por usuário
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

  // Salva histórico sempre que mudar
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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    if (activeAudioRef.current) activeAudioRef.current.stop();
    setIsReading(false);

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
    else if (result) finalContent = `${result.verse}. Contexto: ${result.context}. Análise: ${result.historicalAnalysis}. Insight: ${result.theologicalInsights}`;

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
    >
      {activeTab === 'studies' ? (
        <div className="space-y-8 animate-in slide-in-from-right duration-500">
          <section className="w-full">
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Inicie sua investigação teológica..."
                className="w-full glass bg-white/5 border-white/10 text-white rounded-2xl md:rounded-full py-5 px-8 md:px-10 text-sm md:text-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all shadow-2xl"
              />
              <button 
                type="submit"
                disabled={loading}
                className="absolute right-2 top-2 bottom-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 md:px-10 rounded-xl md:rounded-full transition-all shadow-lg flex items-center gap-2"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-scroll"></i>}
                <span className="hidden md:inline uppercase tracking-widest text-xs">Analisar</span>
              </button>
            </form>
          </section>

          {loading && (
            <div className="glass p-16 rounded-3xl flex flex-col items-center justify-center space-y-4 animate-pulse">
              <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
              <p className="text-white/40 font-serif italic">Pesquisando registros acadêmicos...</p>
            </div>
          )}

          {result && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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

              {imageUrl && (
                <div className="rounded-3xl overflow-hidden glass h-64 md:h-[450px] shadow-2xl border border-white/5 group">
                  <img src={imageUrl} alt="Cena" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-1000" />
                </div>
              )}

              <div className="glass p-8 md:p-14 rounded-[3rem] space-y-12 gloss-effect border border-white/5 shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-8">
                  <h2 className="text-3xl md:text-5xl font-bold text-amber-400 serif">{result.verse}</h2>
                  <button onClick={() => handleRead(result.verse)} className="p-4 glass rounded-full hover:bg-amber-500/20 text-amber-400"><i className="fas fa-volume-up"></i></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white/90 flex items-center gap-2 uppercase tracking-widest"><i className="fas fa-landmark text-amber-500/40"></i> Cenário da Época</h3>
                    <p className="text-white/60 leading-relaxed text-base md:text-lg">{result.context}</p>
                    
                    <h3 className="text-xl font-bold text-white/90 flex items-center gap-2 uppercase tracking-widest pt-8"><i className="fas fa-history text-amber-500/40"></i> Dados Históricos</h3>
                    <p className="text-white/50 italic leading-relaxed">{result.historicalAnalysis}</p>
                  </div>

                  <div className="space-y-8">
                    <h3 className="text-xl font-bold text-white/90 flex items-center gap-2 uppercase tracking-widest"><i className="fas fa-scroll text-amber-500/40"></i> Filologia</h3>
                    <div className="grid gap-4">
                      {result.originalLanguages.map((lang, idx) => (
                        <div key={idx} className="glass bg-white/5 p-5 rounded-2xl border border-white/5">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-serif text-amber-200 text-xl">{lang.term}</span>
                            <span className="text-[10px] text-white/20 italic tracking-widest">{lang.transliteration}</span>
                          </div>
                          <p className="text-xs text-white/40">{lang.meaning}</p>
                        </div>
                      ))}
                    </div>

                    <div className="glass bg-amber-900/10 p-8 rounded-3xl border border-amber-500/10 mt-10">
                      <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2 uppercase tracking-widest"><i className="fas fa-lightbulb"></i> Síntese</h3>
                      <p className="text-white/80 leading-relaxed text-sm md:text-base">{result.theologicalInsights}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="glass p-20 rounded-[3rem] text-center space-y-8 border border-white/5">
              <i className="fas fa-feather-pointed text-7xl text-amber-500/10"></i>
              <div className="space-y-2">
                <h2 className="text-2xl md:text-4xl font-serif text-white/70">Mesa de Estudos</h2>
                <p className="text-white/20 text-xs md:text-sm max-w-lg mx-auto uppercase tracking-widest">A profundidade do texto sagrado ao alcance da tecnologia gramático-histórica.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-left duration-500">
          <div className="flex justify-between items-center px-4">
             <h2 className="text-2xl font-bold text-white/80 serif">Arquivo de Estudos</h2>
             <span className="text-[10px] text-white/20 uppercase tracking-[0.3em]">{history.length} Registros</span>
          </div>

          {history.length === 0 ? (
            <div className="glass p-20 rounded-[3rem] text-center border border-white/5 opacity-50">
              <i className="fas fa-folder-open text-5xl mb-4 block"></i>
              <p className="text-white/30 uppercase tracking-widest text-xs">Seu histórico está vazio.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map((item) => (
                <div 
                  key={item.id} 
                  className="glass p-6 rounded-3xl border border-white/5 hover:bg-white/10 transition-all group flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {item.imageUrl && (
                      <div className="h-32 rounded-2xl overflow-hidden mb-4 border border-white/10">
                        <img src={item.imageUrl} alt="Estudo" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                      </div>
                    )}
                    <h3 className="text-amber-400 font-bold text-lg line-clamp-2">{item.query}</h3>
                    <p className="text-white/40 text-xs line-clamp-3">{item.result.verse}</p>
                  </div>
                  
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
                    <span className="text-[10px] text-white/20">{new Date(item.timestamp).toLocaleDateString()}</span>
                    <button 
                      onClick={() => {
                        setResult(item.result);
                        setImageUrl(item.imageUrl || null);
                        setActiveTab('studies');
                        setQuery(item.query);
                      }}
                      className="text-xs text-amber-500/60 hover:text-amber-400 font-bold uppercase tracking-widest"
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

      <VoiceInteraction />
    </Layout>
  );
};

export default App;
