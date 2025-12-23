import { GoogleGenAI, Type, Modality } from "@google/genai";

export const handler = async (event: any) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTION"
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido' }),
    };
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro de Configuração', 
        details: 'A variável API_KEY não foi configurada no Netlify.' 
      }),
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const { action, payload } = JSON.parse(event.body || '{}');

    switch (action) {
      case 'getExegesis':
        const exegesisResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Analise a consulta bíblica: "${payload.query}". Foque no contexto histórico, arqueológico e termos originais.`,
          config: {
            systemInstruction: "Você é um mestre em exegese bíblica. Responda estritamente com um objeto JSON válido, sem markdown.",
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
          headers,
          body: exegesisResponse.text || '{}',
        };

      case 'generateImage':
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `High quality historical biblical reconstruction: ${payload.prompt}` }] },
          config: { imageConfig: { aspectRatio: "16:9" } }
        });
        
        let b64Image = "";
        const parts = imageResponse.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData) {
            b64Image = part.inlineData.data;
            break;
          }
        }
        return {
          statusCode: 200,
          headers,
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
          headers,
          body: JSON.stringify({ base64: b64Audio }),
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Ação inválida' }),
        };
    }
  } catch (err: any) {
    console.error("Erro interno na função:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro de processamento', details: err.message }),
    };
  }
};