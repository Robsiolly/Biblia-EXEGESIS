
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExegesisResult, MapLocation } from "../types";

const API_KEY = process.env.API_KEY || "";

export const getExegesis = async (query: string): Promise<ExegesisResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  // Obter localização do usuário para toolConfig se possível
  let locationConfig = undefined;
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    });
    locationConfig = {
      latLng: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }
    };
  } catch (e) {
    console.debug("Geolocation not available or denied");
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Realize uma exegese bíblica acadêmica utilizando o método gramático-histórico para: ${query}. 
    Se houver locais geográficos mencionados, identifique-os exatamente.
    
    ESTRUTURA DA RESPOSTA (Use Markdown):
    # [Referência do Versículo]
    
    ## Cenário da Época
    [Descreva o contexto]
    
    ## Análise Filológica e Histórica
    [Descreva a análise]
    
    ## Síntese Teológica
    [Descreva os insights]

    ## Prompt Visual
    [Crie um prompt detalhado em inglês para geração de imagem histórica deste tema. Comece com "IMAGE_PROMPT: "]`,
    config: {
      tools: [{ googleMaps: {} }, { googleSearch: {} }],
      toolConfig: {
        retrievalConfig: locationConfig
      }
    }
  });

  const fullText = response.text || "";
  
  // Extrair Grounding Chunks (Mapas)
  const locations: MapLocation[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  groundingChunks.forEach((chunk: any) => {
    if (chunk.maps) {
      locations.push({
        title: chunk.maps.title || "Localização Encontrada",
        uri: chunk.maps.uri
      });
    }
  });

  // Extrair Verse e Image Prompt do texto
  const verseMatch = fullText.match(/^# (.*)/m);
  const verse = verseMatch ? verseMatch[1] : query;
  
  const promptMatch = fullText.match(/IMAGE_PROMPT: (.*)/);
  const imagePrompt = promptMatch ? promptMatch[1] : `Biblical scene of ${query}`;

  // Limpar o texto para remover o marcador de prompt
  const content = fullText.replace(/IMAGE_PROMPT: .*/, "").trim();

  return {
    verse,
    content,
    locations,
    imagePrompt
  };
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
    const narrationPrompt = `Narre este texto em ${language} de forma ágil, direta e erudita. Inicie a fala imediatamente, sem silêncios: ${text}`;
    
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
        thinkingConfig: { thinkingBudget: 0 }
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
