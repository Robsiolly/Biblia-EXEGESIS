
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult } from "../types";

export const getExegesis = async (query: string): Promise<ExegesisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Realize uma exegese bíblica exaustiva e acadêmica sob a lente do método gramático-histórico para: "${query}". 
    
    DIRETRIZES DE ESTUDO:
    1. CONTEXTO DA ÉPOCA: Detalhe o ambiente sociopolítico, econômico e religioso (ex: domínio Romano, tensões intergrupais, arqueologia).
    2. FILOLOGIA: Analise as palavras-chave no original (Hebraico/Grego) conectando-as ao uso na Septuaginta ou literatura contemporânea.
    3. ANÁLISE: Execute a exegese versículo por versículo se aplicável, focando na intenção original do autor (Exegese vs Eisegese).
    4. SÍNTESE: Conclua com a aplicação teológica reformada clássica.
    
    Responda estritamente em Português seguindo o schema JSON abaixo.`,
    config: {
      tools: [{ googleSearch: {} }],
      // Ativando o Thinking Budget para raciocínio complexo de exegese
      thinkingConfig: { thinkingBudget: 16384 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verse: { type: Type.STRING },
          context: { type: Type.STRING, description: "O Sitz im Leben e o panorama histórico detalhado." },
          historicalAnalysis: { type: Type.STRING, description: "A análise técnica gramatical e contextual." },
          theologicalInsights: { type: Type.STRING, description: "A aplicação doutrinária final." },
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
    const narrationPrompt = `Aja como um professor de seminário erudito. Narre o seguinte texto em ${language} com cadência solene, pausada e clareza didática: ${text}`;
    
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `High-fidelity historical reconstruction, cinematic biblical atmosphere, dramatic lighting: ${prompt}. Realism focus, 4k detail.` }]
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
    console.error("Error generating image:", error);
  }
  return null;
};
