
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

/**
 * SERVIÇO DE CONEXÃO COM GOOGLE GEMINI API
 * Versão: 2.2.0 - Alta Estabilidade
 */

const FALLBACK_KEY = "AIzaSyBWM5U5JaDhVN45ZXMFnbuL0GW4fI5xqm0";

const getApiKey = () => {
  const envKey = process.env.API_KEY;
  if (!envKey || envKey === "" || envKey === "process.env.API_KEY") {
    return FALLBACK_KEY;
  }
  return envKey;
};

// Função de utilidade para re-tentativa com espera (Exponential Backoff)
const fetchWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error.message?.includes("500") || 
                        error.message?.includes("503") || 
                        error.message?.includes("429") ||
                        error.message?.includes("fetch");
    
    if (retries > 0 && isRetryable) {
      console.warn(`Instabilidade detectada. Tentando novamente em ${delay}ms... (${retries} tentativas restantes)`);
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
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // MODELO: gemini-3-pro-preview (Superior para tarefas complexas de exegese)
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Forneça uma exegese teológica exaustiva e análise contextual histórica para: "${query}".`,
      config: {
        systemInstruction: "Você é um professor PhD em Exegese Bíblica e Arqueologia do Oriente Médio. Sua resposta deve ser exclusivamente em formato JSON válido.",
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
    if (!text) throw new Error("A IA retornou um corpo de texto vazio.");
    return JSON.parse(text) as ExegesisResult;
  });
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  return fetchWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
        parts: [{ text: `Authentic biblical era archaeological reconstruction, high resolution, historical accuracy: ${prompt}` }] 
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
  }).catch(() => null); // Imagem é opcional, não trava o app se falhar após retentativas
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
      
      // Garante que o AudioContext esteja ativo (browsers bloqueiam auto-play)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

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
    console.error("Falha na reprodução de áudio:", error);
  }
  return null;
};
