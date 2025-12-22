
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult, MapLocation } from "../types";

export const getExegesis = async (query: string): Promise<ExegesisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  // Obter localização de forma ultra-rápida ou ignorar
  let locationConfig = undefined;
  try {
    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 1500 });
    });
    
    if (position) {
      locationConfig = {
        latLng: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
      };
    }
  } catch (e) {
    console.debug("Geolocation skipped");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Realize uma exegese bíblica acadêmica profunda e análise de contexto histórico para: ${query}. 
      Se houver locais geográficos reais mencionados, identifique-os exatamente.
      
      ESTRUTURA DA RESPOSTA OBRIGATÓRIA (Use Markdown):
      # [Referência ou Título do Estudo]
      
      ## Cenário da Época e Contexto Histórico
      [Descreva detalhadamente a cultura, política e sociedade da época]
      
      ## Análise Filológica e Gramatical
      [Descreva a análise de termos originais se aplicável]
      
      ## Aplicação e Síntese Teológica
      [Descreva os insights para hoje]

      IMAGE_PROMPT: [Crie um prompt detalhado em inglês para uma imagem realista e cinematográfica deste cenário bíblico]`,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: {
          retrievalConfig: locationConfig
        }
      }
    });

    const fullText = response.text || "";
    if (!fullText) throw new Error("A IA não retornou conteúdo textual.");
    
    // Extrair Grounding Chunks (Mapas)
    const locations: MapLocation[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    groundingChunks.forEach((chunk: any) => {
      if (chunk.maps) {
        locations.push({
          title: chunk.maps.title || "Localização Arqueológica",
          uri: chunk.maps.uri
        });
      }
    });

    // Parsing do texto
    const verseMatch = fullText.match(/^# (.*)/m);
    const verse = verseMatch ? verseMatch[1] : query;
    
    const promptMatch = fullText.match(/IMAGE_PROMPT: (.*)/);
    const imagePrompt = promptMatch ? promptMatch[1] : `Biblical landscape of ${query}, highly detailed, historical`;

    // Limpar o texto para remover o marcador de prompt
    const content = fullText.replace(/IMAGE_PROMPT: .*/, "").trim();

    return {
      verse,
      content,
      locations,
      imagePrompt
    };
  } catch (error) {
    console.error("Erro na chamada Gemini:", error);
    throw error;
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  try {
    const narrationPrompt = `Narre este texto em ${language} de forma solene e erudita: ${text}`;
    
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
      source.start(0);

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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A historical cinematic wide shot of ${prompt}. Masterpiece, hyper-realistic, biblical context, 8k resolution, archaeological accuracy.` }]
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
