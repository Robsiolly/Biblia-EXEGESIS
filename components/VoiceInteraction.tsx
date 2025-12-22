
import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';

interface VoiceInteractionProps {
  onPerformSearch?: (query: string) => void;
}

const VoiceInteraction: React.FC<VoiceInteractionProps> = ({ onPerformSearch }) => {
  const [isActive, setIsActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState('IA Conectada. Pergunte sobre qualquer passagem.');
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

  const analyzePassageFn: FunctionDeclaration = {
    name: 'analyzePassage',
    description: 'Realiza uma exegese profunda e análise histórica de uma passagem bíblica ou tema teológico.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'A passagem bíblica (ex: João 3:16) ou o tema (ex: A Arca da Aliança) para analisar.'
        }
      },
      required: ['query']
    }
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
          // Handle tool calls (Function Calling)
          if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
              if (fc.name === 'analyzePassage') {
                const query = (fc.args as any).query;
                setStatusMessage(`Analisando: ${query}...`);
                if (onPerformSearch) {
                  onPerformSearch(query);
                }
                sessionPromise.then(session => {
                  session.sendToolResponse({
                    functionResponses: {
                      id: fc.id,
                      name: fc.name,
                      response: { result: "Iniciando análise profunda na interface principal." }
                    }
                  });
                });
              }
            }
          }

          // Handle audio output
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
        systemInstruction: "Você é um professor de exegese bíblica erudito e amigável. Você pode realizar exegeses profundas usando a ferramenta 'analyzePassage' quando o usuário pedir para analisar um versículo ou tema. Responda em Português, de forma sóbria e acadêmica.",
        tools: [{ functionDeclarations: [analyzePassageFn] }],
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
    setStatusMessage('IA Conectada. Pergunte sobre qualquer passagem.');
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <button 
        onClick={isActive ? stopSession : startSession}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl glass ${isActive ? 'bg-red-500/30 scale-110' : 'bg-emerald-500/20 hover:bg-emerald-500/40 group'}`}
        title={isActive ? "Parar conversa" : "Conversar com o Professor de Exegese"}
      >
        <i className={`fas ${isActive ? 'fa-stop text-red-400' : 'fa-microphone text-emerald-400'} text-xl group-hover:scale-110 transition-transform`}></i>
        {isActive && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
          </span>
        )}
      </button>
      {isActive && (
        <div className="absolute bottom-20 right-0 glass p-5 rounded-3xl w-72 text-xs animate-in slide-in-from-bottom-4 duration-300 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-indigo-950/40">
          <p className="text-white/80 mb-3 font-medium">{statusMessage}</p>
          <div className="flex gap-1 items-end h-4">
             {[1,2,3,4,5,6,7].map(i => (
               <div key={i} className="flex-1 bg-emerald-400/50 rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i*0.1}s` }}></div>
             ))}
          </div>
          <p className="text-[10px] text-white/30 mt-4 uppercase tracking-widest text-center italic">Conversa em Tempo Real</p>
        </div>
      )}
    </div>
  );
};

export default VoiceInteraction;
