
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

// Função utilitária para obter a instância da IA com a chave de ambiente
const getAIInstance = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const getExegesis = async (query: string): Promise<ExegesisResult> => {
  const ai = getAIInstance();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Realize uma exegese bíblica exaustiva e acadêmica sob a lente do método gramático-histórico para: "${query}". 
      
      DIRETRIZES DE ESTUDO:
      1. CONTEXTO DA ÉPOCA: Detalhe o ambiente sociopolítico e o "Sitz im Leben".
      2. FILOLOGIA: Analise palavras-chave no Hebraico/Grego original.
      3. ANÁLISE: Foco na intenção original do autor.
      4. SÍNTESE: Conclua com aplicação teológica reformada.
      
      Responda estritamente em Português seguindo o schema JSON.`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 16384 },
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

    const resultText = response.text || "{}";
    const result: ExegesisResult = JSON.parse(resultText);
    
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
  } catch (error) {
    console.error("Critical Exegesis Error:", error);
    throw new Error("Falha ao conectar com o laboratório exegético. Verifique sua conexão e configurações de API.");
  }
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
  const ai = getAIInstance();
  try {
    const narrationPrompt = `Aja como um professor de seminário erudito. Narre com solenidade e clareza didática o seguinte texto em ${language}: ${text}`;
    
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
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed;
      source.connect(audioContext.destination);
      source.start();

      return {
        stop: () => { try { source.stop(); } catch(e) {} },
        setSpeed: (s: number) => { source.playbackRate.value = s; }
      };
    }
  } catch (error) {
    console.error("Audio Engine Error:", error);
  }
  return null;
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  const ai = getAIInstance();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Historical biblical reconstruction, academic realism, 4k cinematic lighting: ${prompt}` }]
      },
      config: {
        imageConfig: { aspectRatio: "16:9" }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (error) {
    console.error("Visual Engine Error:", error);
  }
  return null;
};
