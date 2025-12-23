
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

// Helper function to initialize Google GenAI using the environment variable API_KEY
const getAI = () => {
  // Always use process.env.API_KEY directly as mandated by coding guidelines
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("Chave de API não detectada. Certifique-se de que a variável de ambiente API_KEY está configurada.");
  }
  return new GoogleGenAI({ apiKey });
};

export interface AudioControl {
  stop: () => void;
  setSpeed: (speed: number) => void;
}

// Manual base64 decoding implementation as required for audio streaming
const decodeBase64 = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Raw PCM audio decoding logic based on GenAI SDK documentation
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
    // Using gemini-3-pro-preview for complex reasoning and academic tasks
    model: 'gemini-3-pro-preview',
    contents: `Realize uma exegese bíblica e análise de contexto da época sobre: "${query}".`,
    config: {
      systemInstruction: `Você é um historiador e teólogo erudito. Forneça uma análise profunda e acadêmica. 
      Retorne sempre um JSON válido conforme o esquema. Use Google Search para validar fatos arqueológicos recentes.`,
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
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

  // Directly access .text property as per guidelines (not a method call)
  const text = response.text;
  if (!text) throw new Error("Falha na comunicação com o motor de IA.");
  
  const result = JSON.parse(text) as ExegesisResult;
  
  // Extract URLs from groundingChunks when googleSearch tool is used
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks) {
    result.sources = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        uri: chunk.web.uri,
        title: chunk.web.title
      }));
  }

  return result;
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = getAI();
    const safetyPrompt = `Historical archaeological reconstruction of: ${prompt}. Cinematic lighting, museum quality detail, ancient textures, 8k resolution. Artistic style: Oil painting or realistic digital matte painting.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: safetyPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    if (!response.candidates?.[0]?.content?.parts) return null;

    // Iterate through parts to find the image part specifically
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Geração de imagem ignorada:", error);
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

    // Access the generated audio data from parts[0].inlineData.data
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const bytes = decodeBase64(base64Audio);
      // Decode raw PCM data returned by the API
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
    console.error("Erro na síntese de áudio:", error);
  }
  return null;
};
