
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

const API_KEY = process.env.API_KEY || "";

export const getExegesis = async (query: string): Promise<ExegesisResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Realize uma exegese bíblica acadêmica e profunda utilizando o método gramático-histórico para: ${query}. 
    Foque na análise filológica, cenário histórico e cultural da época. 
    Mantenha um tom erudito, sóbrio e rigoroso. Evite terminologias contemporâneas emocionais. Responda em Português.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verse: { type: Type.STRING },
          context: { type: Type.STRING, description: "O cenário histórico e cultural baseado em fatos da época." },
          historicalAnalysis: { type: Type.STRING, description: "Análise acadêmica do contexto temporal." },
          theologicalInsights: { type: Type.STRING, description: "Implicações do texto baseadas em erudição clássica." },
          originalLanguages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                transliteration: { type: Type.STRING },
                meaning: { type: Type.STRING }
              }
            }
          },
          imagePrompt: { type: Type.STRING, description: "Prompt visual realista e histórico." }
        },
        required: ["verse", "context", "historicalAnalysis", "theologicalInsights", "originalLanguages", "imagePrompt"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export interface AudioControl {
  stop: () => void;
  setSpeed: (speed: number) => void;
}

export const playAudio = async (
  text: string, 
  voice: string = 'Kore', 
  speed: number = 1.0,
  language: string = 'Português'
): Promise<AudioControl | null> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  try {
    const narrationPrompt = `Narre este estudo teológico com um tom erudito, solene e respeitoso em ${language}. A voz deve ser clara, pausada e transmitir autoridade acadêmica: ${text}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: narrationPrompt }] }],
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
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const dataInt16 = new Int16Array(bytes.buffer);
      const frameCount = dataInt16.length;
      const buffer = audioContext.createBuffer(1, frameCount, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed;
      source.connect(audioContext.destination);
      source.start();

      return {
        stop: () => {
          try { source.stop(); } catch(e) {}
        },
        setSpeed: (s: number) => {
          source.playbackRate.value = s;
        }
      };
    }
  } catch (error) {
    console.error("Error playing audio:", error);
  }
  return null;
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A highly detailed, realistic historical cinematic depiction of: ${prompt}. Cinematic lighting, ancient atmosphere, 4k resolution, museum quality.` }]
      },
      config: {
        imageConfig: { aspectRatio: "16:9" }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Error generating image:", error);
  }
  return null;
};
