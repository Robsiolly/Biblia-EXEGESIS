import { ExegesisResult } from "../types";

export interface AudioControl {
  stop: () => void;
  setSpeed: (speed: number) => void;
}

/**
 * Chama o backend centralizado. 
 * Em produção no Netlify, /api/exegesis é redirecionado para a função exegesis.
 */
const callBackend = async (action: string, payload: any) => {
  try {
    const response = await fetch('/api/exegesis', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, payload }),
    });

    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Resposta do servidor não é JSON:", responseText);
      throw new Error(`Erro de comunicação com o servidor AI.`);
    }

    if (!response.ok) {
      throw new Error(data?.details || data?.error || `Erro do servidor (${response.status})`);
    }

    return data;
  } catch (error: any) {
    console.error(`Erro no GeminiService [${action}]:`, error.message);
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
    
    if (data && data.base64) {
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
        setSpeed: (s: number) => { 
          if (source) source.playbackRate.value = s; 
        }
      };
    }
  } catch (error) {
    console.error("Falha ao reproduzir áudio:", error);
  }
  return null;
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  try {
    const data = await callBackend('generateImage', { prompt });
    return data && data.base64 ? `data:image/png;base64,${data.base64}` : null;
  } catch (error) {
    console.error("Falha ao gerar imagem:", error);
    return null;
  }
};