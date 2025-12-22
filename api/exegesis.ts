
import { GoogleGenAI, Type, Modality } from "@google/genai";

export const config = {
  maxDuration: 60, 
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Configuração Incompleta', details: 'A variável API_KEY não foi encontrada no ambiente da Vercel.' });
  }

  const { action, payload } = req.body;
  const ai = new GoogleGenAI({ apiKey });

  try {
    switch (action) {
      case 'getExegesis':
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analise exgeticamente: "${payload.query}". Forneça contexto histórico, termos originais e insights teológicos.`,
          config: {
            thinkingConfig: { thinkingBudget: 1000 },
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
        return res.status(200).json(JSON.parse(response.text || "{}"));

      case 'generateImage':
        const imageRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `High quality biblical reconstruction: ${payload.prompt}` }] },
          config: { imageConfig: { aspectRatio: "16:9" } }
        });
        const imagePart = imageRes.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return res.status(200).json({ base64: imagePart?.inlineData?.data || null });

      case 'generateTTS':
        const ttsRes = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: payload.text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: payload.voice || 'Kore' } },
            },
          },
        });
        const audioData = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return res.status(200).json({ base64: audioData || null });

      default:
        return res.status(400).json({ error: 'Ação inválida' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro na IA', details: err.message });
  }
}
