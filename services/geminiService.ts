
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

/**
 * SERVIÇO DE CONEXÃO COM GOOGLE GEMINI API
 * Versão: 2.3.0 - Resiliência e Gestão de Chave
 */

const getApiKey = () => {
  // A plataforma injeta automaticamente a chave selecionada em process.env.API_KEY
  const key = process.env.API_KEY;
  if (!key || key === "process.env.API_KEY" || key.trim() === "") {
    // Retornamos vazio para que o app saiba que precisa disparar o fluxo de seleção
    return "";
  }
  return key;
};

const fetchWithRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error.message?.includes("500") || 
                        error.message?.includes("503") || 
                        error.message?.includes("fetch");
    
    // Se for erro de cota (429), não tentamos de novo automaticamente, pois a cota demora a resetar
    if (retries > 0 && isRetryable) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
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
  return fetchWithRetry(async () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Chave de API não configurada. Por favor, conecte sua chave.");
    
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Realize uma exegese acadêmica e profunda para: "${query}".`,
      config: {
        systemInstruction: "Você é um professor PhD em Teologia Bíblica e Arqueologia. Responda APENAS em JSON.",
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
    if (!text) throw new Error("Resposta da IA vazia.");
    return JSON.parse(text) as ExegesisResult;
  });
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  return fetchWithRetry(async () => {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
        parts: [{ text: `Authentic archaeological reconstruction, biblical period, cinematic realism: ${prompt}` }] 
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
  }).catch(() => null);
};

export const playAudio = async (text: string, voice: string = 'Kore'): Promise<AudioControl | null> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
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
      if (audioContext.state === 'suspended') await audioContext.resume();

      const bytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeRawPCM(bytes, audioContext, 24000, 1);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();

      return {
        stop: () => { try { source.stop(); } catch(e) {} },
        setSpeed: (s: number) => { if (source) source.playbackRate.value = s; }
      };
    }
  } catch (error) {
    console.error("Falha TTS:", error);
  }
  return null;
};
