
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

const VoiceInteraction: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState('');
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

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const startSession = async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const outputNode = audioContextRef.current.createGain();
    outputNode.connect(audioContextRef.current.destination);

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
            const inputData = e.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
              int16[i] = inputData[i] * 32768;
            }
            const pcmBlob = {
              data: encode(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
          };
          
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
            const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
            const ctx = audioContextRef.current!;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
            
            const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
            source.onended = () => sourcesRef.current.delete(source);
          }

          if (message.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }
        },
        onclose: () => setIsActive(false),
        onerror: (e) => console.error("Live AI error", e)
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "Você é um professor de exegese bíblica. Responda perguntas sobre a Bíblia e seu contexto histórico de forma gentil e erudita. Use voz clara e pausada.",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
        }
      }
    });

    sessionRef.current = await sessionPromise;
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsActive(false);
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <button 
        onClick={isActive ? stopSession : startSession}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl glass ${isActive ? 'bg-red-500/30 scale-110' : 'bg-emerald-500/20 hover:bg-emerald-500/40'}`}
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
        <div className="absolute bottom-20 right-0 glass p-4 rounded-2xl w-64 text-xs animate-in slide-in-from-bottom-4 duration-300">
          <p className="text-white/60 mb-2">IA Conectada. Pergunte sobre qualquer passagem ou contexto histórico.</p>
          <div className="flex gap-1">
             {[1,2,3,4,5].map(i => (
               <div key={i} className="w-1 h-4 bg-emerald-400/50 rounded-full animate-pulse" style={{ animationDelay: `${i*0.1}s` }}></div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceInteraction;