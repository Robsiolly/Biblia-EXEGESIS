
import { ExegesisResult } from "../types";

export interface AudioControl {
  stop: () => void;
  setSpeed: (speed: number) => void;
}

const callBackend = async (action: string, payload: any) => {
  const response = await fetch('/api/exegesis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro na requisição ao backend');
  }

  return response.json();
};

export const getExegesis = async (query: string): Promise<ExegesisResult> => {
  try {
    return await callBackend('getExegesis', { query });
  } catch (error: any) {
    console.error("Exegesis Service Error:", error);
    throw new Error("Falha ao processar exegese no servidor.");
  }
};

export const playAudio = async (
  text: string, 
  voice: string = 'Kore', 
  speed: number = 1.0,
  language: string = 'Português'
): Promise<AudioControl | null> => {
  try {
    const data = await callBackend('generateTTS', { text, voice, language });
    
    if (data.base64) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const binaryString = atob(data.base64);
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
    console.error("Audio Service Error:", error);
  }
  return null;
};

export const generateHistoricalImage = async (prompt: string): Promise<string | null> => {
  try {
    const data = await callBackend('generateImage', { prompt });
    return data.base64 ? `data:image/png;base64,${data.base64}` : null;
  } catch (error) {
    console.error("Image Service Error:", error);
  }
  return null;
};
