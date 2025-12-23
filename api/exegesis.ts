
import { GoogleGenAI, Type, Modality } from "@google/genai";

export const handler = async (event: any) => {
  // Apenas permitir requisições POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método não permitido' }),
    };
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Erro de Configuração', 
        details: 'A variável API_KEY não foi encontrada no ambiente do Netlify. Verifique as configurações do site.' 
      }),
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const { action, payload } = JSON.parse(event.body);

    switch (action) {
      case 'getExegesis':
        // Usando gemini-3-flash-preview para evitar timeouts no Netlify (limite de 10s)
        const exegesisResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Analise a consulta bíblica: "${payload.query}". Foque no contexto histórico e linguístico da época.`,
          config: {
            systemInstruction: "Você é um mestre em exegese bíblica e arqueologia. Responda estritamente em JSON.",
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
                      meaning: { type: Type.STRING },
                    },
                    required: ["term", "transliteration", "meaning"],
                  }
                },
                imagePrompt: { type: Type.STRING },
              },
              required: ["verse", "context", "historicalAnalysis", "theologicalInsights", "originalLanguages", "imagePrompt"],
            }
          }
        });

        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(JSON.parse(exegesisResponse.text || "{}")),
        };

      case 'generateImage':
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `Biblical historical reconstruction, cinematic: ${payload.prompt}` }] },
          config: { imageConfig: { aspectRatio: "16:9" } }
        });
        
        let b64Image = "";
        if (imageResponse.candidates?.[0]?.content?.parts) {
          for (const part of imageResponse.candidates[0].content.parts) {
            if (part.inlineData) {
              b64Image = part.inlineData.data;
              break;
            }
          }
        }
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: b64Image }),
        };

      case 'generateTTS':
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: payload.text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: payload.voice || 'Kore' },
              },
            },
          },
        });
        
        const b64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: b64Audio }),
        };

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Ação inválida' }),
        };
    }
  } catch (err: any) {
    console.error("Erro na API:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro de processamento', details: err.message }),
    };
  }
};
