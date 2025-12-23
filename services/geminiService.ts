
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

/**
 * SERVIÇO DE CONEXÃO COM GOOGLE GEMINI API
 * Versão: 2.1.0 - Estável
 */

const FALLBACK_KEY = "AIzaSyBWM5U5JaDhVN45ZXMFnbuL0GW4fI5xqm0";

const getApiKey = () => {
  // Tenta obter do ambiente do Vercel/Vite
  const envKey = process.env.API_KEY;
  
  // Verifica se a chave é válida (não vazia e não é o nome da própria variável)
  if (!envKey || envKey === "" || envKey === "process.env.API_KEY") {
    console.warn("Utilizando chave de fallback. Verifique as variáveis de ambiente no Vercel.");
    return FALLBACK_KEY;
  }
  return envKey;
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
    
    // MODELO: gemini-3-flash-preview (Oficial para tarefas de texto e lógica)
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Realize uma exegese teológica profunda e análise de contexto histórico da época para: "${query}".`,
      config: {
        systemInstruction: "Você é um especialista em línguas originais bíblicas (Hebraico, Aramaico e Grego) e Arqueologia. Responda estritamente em JSON.",
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
  } catch (error: any) {
    console.error("Erro Crítico Gemini API:", error);
    const apiMsg = error.message || "";
    
    if (apiMsg.includes("not found")) {
      throw new Error("Erro de Versão de Modelo (404). O Google ainda está propagando o modelo gemini-3-flash-preview para sua região.");
    }
    if (apiMsg.includes("API key not valid")) {
      throw new Error("Chave de API Inválida. Verifique sua configuração no Vercel.");
    }
    
    throw new Error(apiMsg || "Falha na comunicação com o servidor teológico.");
  }
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    // MODELO: gemini-2.5-flash-image (Oficial para geração de imagens)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
        parts: [{ text: `Biblical archaeological scene, ultra realistic, cinematic lighting, ancient world atmosphere: ${prompt}` }] 
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
    console.warn("Geração de imagem falhou:", error);
    return null;
  }
};

export const playAudio = async (text: string, voice: string = 'Kore'): Promise<AudioControl | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    // MODELO: gemini-2.5-flash-preview-tts (Oficial para conversão texto-voz)
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
    console.error("Falha no TTS:", error);
  }
  return null;
};
