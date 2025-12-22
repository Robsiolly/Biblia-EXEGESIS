
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

const VoiceInteraction: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const decodeBase64 = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const encodeBase64 = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const stopSession = () => {
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }
    setIsActive(false);
    setError(null);
  };

  const startSession = async () => {
    setError(null);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (sessionRef.current) {
                const inputData = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  int16[i] = inputData[i] * 32768;
                }
                const pcmBlob = {
                  data: encodeBase64(new Uint8Array(int16.buffer)),
                  mimeType: 'audio/pcm;rate=16000',
                };
                sessionPromise.then(session => {
                  try { session.sendRealtimeInput({ media: pcmBlob }); } catch(err) {}
                });
              }
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const ctx = audioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const buffer = await decodeAudioData(decodeBase64(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setIsActive(false);
          },
          onerror: (e) => {
            console.error("Live AI Error:", e);
            setError("Erro na conexão com a IA.");
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Você é um mentor acadêmico de estudos bíblicos. Responda com clareza e profundidade teológica em Português.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Voice initialization error:", err);
      setError("Microfone não disponível ou erro de rede.");
      setIsActive(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4">
      {error && (
        <div className="glass bg-red-500/10 border-red-500/20 p-4 rounded-2xl text-[10px] text-red-400 uppercase tracking-widest animate-in fade-in slide-in-from-right-4">
          <i className="fas fa-exclamation-triangle mr-2"></i> {error}
        </div>
      )}
      <div className="relative">
        <button 
          onClick={isActive ? stopSession : startSession}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl glass border ${isActive ? 'bg-red-500/30 scale-110 border-red-500/50' : 'bg-emerald-500/20 hover:bg-emerald-500/40 border-emerald-500/30'}`}
        >
          <i className={`fas ${isActive ? 'fa-stop text-red-400' : 'fa-microphone text-emerald-400'} text-xl`}></i>
          {isActive && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
            </span>
          )}
        </button>
        {isActive && (
          <div className="absolute bottom-20 right-0 glass p-5 rounded-3xl w-72 text-xs animate-in slide-in-from-bottom-4 duration-300 shadow-2xl border-white/10">
            <p className="text-emerald-400 font-serif italic mb-2">Mentor Conectado</p>
            <p className="text-white/40 leading-relaxed">A IA está ouvindo. Faça sua pergunta sobre o contexto histórico ou exegese bíblica.</p>
            <div className="flex gap-1 mt-4">
               {[1,2,3,4,5,6].map(i => (
                 <div key={i} className="w-1.5 h-4 bg-emerald-400/30 rounded-full animate-bounce" style={{ animationDelay: `${i*0.1}s` }}></div>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceInteraction;
