import { ExegesisResult } from "../types";

export interface AudioControl {
  stop: () => void;
  setSpeed: (speed: number) => void;
}

const callBackend = async (action: string, payload: any) => {
  try {
    const response = await fetch('/api/exegesis', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ action, payload }),
    });

    const contentType = response.headers.get("content-type");
    
    if (!response.ok) {
      let errorText = "";
      try {
        const errorJson = await response.json();
        errorText = errorJson.details || errorJson.error;
      } catch (e) {
        errorText = await response.text();
      }
      throw new Error(errorText || `Erro do Servidor (${response.status})`);
    }

    if (!contentType || !contentType.includes("application/json")) {
      const rawText = await response.text();
      console.error("Servidor retornou algo que não é JSON:", rawText);
      throw new Error("O servidor não respondeu com JSON. Verifique se as funções do backend foram publicadas corretamente.");
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Falha no GeminiService [${action}]:`, error);
    throw error;
  }
};

export const getExegesis = async (query: string): Promise<ExegesisResult> => {
  return await callBackend('getExegesis', { query });
};

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

export const playAudio = async (
  text: string, 
  voice: string = 'Kore', 
  speed: number = 1.0
): Promise<AudioControl | null> => {
  try {
    const data = await callBackend('generateTTS', { text, voice });
    
    if (data.base64) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const bytes = decodeBase64(data.base64);
      const audioBuffer = await decodeRawPCM(bytes, audioContext, 24000, 1);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = speed;
      source.connect(audioContext.destination);
      source.start();

      return {
        stop: () => { try { source.stop(); } catch(e) {} },
        setSpeed: (s: number) => { source.playbackRate.value = s; }
      };
    }
  } catch (error) {
    console.error("Erro ao reproduzir áudio:", error);
  }
  return null;
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  try {
    const data = await callBackend('generateImage', { prompt });
    return data.base64 ? `data:image/png;base64,${data.base64}` : null;
  } catch (error) {
    console.error("Erro ao gerar imagem:", error);
    return null;
  }
};