
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

// Removed global API_KEY to ensure fresh instances use latest key

export const getExegesis = async (query: string): Promise<ExegesisResult> => {
  // Always create a new GoogleGenAI instance right before the call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Realize uma exegese bíblica acadêmica profunda sob a perspectiva Protestante Reformada (Método Gramático-Histórico) para o tema: "${query}". 
    
    Instruções:
    1. Foque no contexto da época (político, social, cultural).
    2. Analise termos originais (Hebraico/Grego) de forma precisa.
    3. Mantenha um tom sóbrio, erudito e reverente.
    4. Gere um prompt para imagem histórica.
    
    Responda em Português seguindo estritamente o schema JSON.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verse: { type: Type.STRING },
          context: { type: Type.STRING, description: "Cenário histórico detalhado." },
          historicalAnalysis: { type: Type.STRING, description: "Análise gramático-histórica." },
          theologicalInsights: { type: Type.STRING, description: "Síntese doutrinária reformada." },
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
          imagePrompt: { type: Type.STRING }
        },
        required: ["verse", "context", "historicalAnalysis", "theologicalInsights", "originalLanguages", "imagePrompt"]
      }
    }
  });

  const text = response.text || "{}";
  const result: ExegesisResult = JSON.parse(text);
  
  // Extract website URLs from groundingChunks as per mandatory guidelines
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    result.sources = chunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        uri: chunk.web.uri,
        title: chunk.web.title,
      }));
  }

  return result;
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const narrationPrompt = `Aja como um professor de seminário erudito. Narre o seguinte texto em ${language} com cadência solene, pausada e clareza didática. Respeite as vírgulas e pontos para criar uma atmosfera de respeito ao conhecimento: ${text}`;
    
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
      // Implement manual decoding logic as per guidelines (no external base64 libs)
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Historical cinematic hyper-realistic rendering, biblical atmosphere: ${prompt}. Muted colors, detailed textures, ancient architecture accuracy.` }]
      },
      config: {
        imageConfig: { aspectRatio: "16:9" }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        // Find the image part as per guideline instructions
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (error) {
    console.error("Error generating image:", error);
  }
  return null;
};
