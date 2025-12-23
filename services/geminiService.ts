
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

// Fallback manual para garantir funcionamento imediato
const HARDCODED_KEY = "AIzaSyBWM5U5JaDhVN45ZXMFnbuL0GW4fI5xqm0";

const getApiKey = () => {
  let apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "process.env.API_KEY" || apiKey.trim() === "") {
    return HARDCODED_KEY;
  }
  return apiKey;
};

export interface AudioControl {
  stop: () => void;
  setSpeed: (speed: number) => void;
}

const decodeBase64 = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeRawPCM = async (
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

export const getExegesis = async (query: string): Promise<ExegesisResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // Usando o modelo correto para tarefas de texto: gemini-3-flash-preview
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Realize uma análise exegética e de contexto histórico profundo para: "${query}".`,
      config: {
        systemInstruction: "Você é um acadêmico PhD em Teologia Bíblica e História da Antiguidade. Responda estritamente em JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verse: { type: Type.STRING },
            context: { type: Type.STRING },
            historicalAnalysis: { type: Type.STRING },
            theologicalInsights: { type: Type.STRING },
            originalLanguages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  transliteration: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                },
                required: ["term", "transliteration", "meaning"]
              }
            },
            imagePrompt: { type: Type.STRING },
          },
          required: ["verse", "context", "historicalAnalysis", "theologicalInsights", "originalLanguages", "imagePrompt"],
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("A IA retornou uma resposta vazia.");
    return JSON.parse(text) as ExegesisResult;
  } catch (error: any) {
    console.error("Erro na API Gemini:", error);
    // Tratamento de erro específico para facilitar o diagnóstico
    if (error.message?.includes("not found")) {
      throw new Error("Erro de Configuração de Modelo. O servidor não reconheceu o modelo gemini-3-flash-preview.");
    }
    throw new Error(error.message || "Erro inesperado ao processar exegese.");
  }
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
        parts: [{ text: `High quality archaeological reconstruction, biblical period, museum style, realistic: ${prompt}` }] 
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.warn("Falha na geração de imagem:", error);
    return null;
  }
};

export const playAudio = async (text: string, voice: string = 'Kore'): Promise<AudioControl | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const bytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeRawPCM(bytes, audioContext, 24000, 1);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();

      return {
        stop: () => { try { source.stop(); } catch(e) {} },
        setSpeed: (s: number) => { 
          if (source) source.playbackRate.value = s; 
        }
      };
    }
  } catch (error) {
    console.error("Erro no áudio:", error);
  }
  return null;
};
