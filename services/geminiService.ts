
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

// Fallback manual caso o Vercel não injete a variável de ambiente corretamente
const HARDCODED_KEY = "AIzaSyBWM5U5JaDhVN45ZXMFnbuL0GW4fI5xqm0";

const getAI = () => {
  // Tenta pegar do ambiente (Vercel), se for a string literal ou vazio, usa a hardcoded
  let apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "process.env.API_KEY" || apiKey.length < 10) {
    apiKey = HARDCODED_KEY;
  }
  
  return new GoogleGenAI({ apiKey });
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
    const ai = getAI();
    // Usando gemini-2.5-flash-lite-latest para máxima compatibilidade global
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-latest',
      contents: `Analise exegética profunda: "${query}". Foco em contexto histórico, geográfico e linguístico.`,
      config: {
        systemInstruction: "Você é um PhD em Teologia e Arqueologia Bíblica. Responda APENAS em JSON. Seja acadêmico e preciso.",
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
    if (!text) throw new Error("A IA não retornou dados. Verifique sua cota da API.");
    return JSON.parse(text) as ExegesisResult;
  } catch (error: any) {
    console.error("DEBUG API GOOGLE:", error);
    // Extrai a mensagem de erro real para o usuário
    const errMsg = error.message || "Erro de conexão com o servidor da Google.";
    if (errMsg.includes("API key not valid")) throw new Error("CHAVE DE API INVÁLIDA. Verifique se copiou corretamente.");
    if (errMsg.includes("429")) throw new Error("LIMITE DE COTAS EXCEDIDO. Tente novamente em 60 segundos.");
    throw new Error(errMsg);
  }
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `Archaeological biblical scene: ${prompt}. Oil painting style.` }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) {
    console.warn("Imagem não gerada:", error);
    return null;
  }
};

export const playAudio = async (text: string, voice: string = 'Kore'): Promise<AudioControl | null> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
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
      return { stop: () => source.stop(), setSpeed: (s) => { source.playbackRate.value = s; } };
    }
  } catch (e) { console.error("Erro Áudio:", e); }
  return null;
};
