
import { GoogleGenAI, Type, Modality } from "@google/genai";

export const config = {
  maxDuration: 60, // Aumentado para suportar o Thinking Budget de exegese profunda
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, payload } = req.body;

  try {
    switch (action) {
      case 'getExegesis':
        const textResponse = await ai.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: `Realize uma exegese bíblica exaustiva e acadêmica sob a lente do método gramático-histórico para: "${payload.query}". 
          DIRETRIZES: Contexto sociopolítico, Filologia Hebraico/Grego, Intenção original e Síntese reformada.`,
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

        const resultText = textResponse.text || "{}";
        const result = JSON.parse(resultText);
        
        // Grounding Metadata handling
        const chunks = textResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          result.sources = chunks
            .filter((chunk: any) => chunk.web)
            .map((chunk: any) => ({
              uri: chunk.web.uri,
              title: chunk.web.title,
            }));
        }
        return res.status(200).json(result);

      case 'generateImage':
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: `Historical biblical reconstruction, academic realism, 4k cinematic lighting: ${payload.prompt}` }]
          },
          config: {
            imageConfig: { aspectRatio: "16:9" }
          }
        });

        let base64Image = null;
        if (imageResponse.candidates?.[0]?.content?.parts) {
          for (const part of imageResponse.candidates[0].content.parts) {
            if (part.inlineData) {
              base64Image = part.inlineData.data;
              break;
            }
          }
        }
        return res.status(200).json({ base64: base64Image });

      case 'generateTTS':
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Aja como um professor de seminário erudito. Narre com solenidade em ${payload.language}: ${payload.text}` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: payload.voice || 'Kore' },
              },
            },
          },
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return res.status(200).json({ base64: base64Audio });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
