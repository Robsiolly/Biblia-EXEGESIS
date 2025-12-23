
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

// Inicialização segura usando a variável de ambiente obrigatória
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Realize uma exegese bíblica acadêmica, arqueológica e histórica profunda sobre: "${query}". 
    Analise o contexto sociopolítico, termos originais (Grego/Hebraico) e traga implicações teológicas contemporâneas.`,
    config: {
      systemInstruction: "Você é um mestre em exegese bíblica e história do Oriente Próximo. Responda estritamente em JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verse: { type: Type.STRING, description: "Referência bíblica principal" },
          context: { type: Type.STRING, description: "Contexto histórico e social da época" },
          historicalAnalysis: { type: Type.STRING, description: "Análise crítica e arqueológica" },
          theologicalInsights: { type: Type.STRING, description: "Significado teológico e aplicação" },
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
          imagePrompt: { type: Type.STRING, description: "Prompt visual para gerar uma imagem histórica realística" },
        },
        required: ["verse", "context", "historicalAnalysis", "theologicalInsights", "originalLanguages", "imagePrompt"],
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("A IA não retornou dados válidos.");
  return JSON.parse(text) as ExegesisResult;
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Historical reconstruction, archaeological accuracy, cinematic lighting, biblical times, high detail: ${prompt}` }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Erro ao gerar imagem:", error);
    return null;
  }
};

export const playAudio = async (
  text: string, 
  voice: string = 'Kore', 
  speed: number = 1.0
): Promise<AudioControl | null> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Leia com tom acadêmico e solene: ${text}` }] }],
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
      source.playbackRate.value = speed;
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
    console.error("Erro na síntese de voz:", error);
  }
  return null;
};
