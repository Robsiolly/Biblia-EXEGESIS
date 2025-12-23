import { GoogleGenAI, Type, Modality } from "@google/genai";

/**
 * Handler para Netlify Functions.
 * O nome do arquivo (exegesis.ts) determina o endpoint: /.netlify/functions/exegesis
 */
export const handler = async (event: any) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  // Resposta para Preflight (CORS)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Apenas POST é permitido para as ações da IA
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido.' }),
    };
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("ERRO: API_KEY não configurada no ambiente do Netlify.");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuração Incompleta: API_KEY ausente.' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, payload } = body;

    if (!action) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Ação não especificada.' }) 
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    switch (action) {
      case 'getExegesis':
        const exegesisRes = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Realize uma exegese técnica e histórica profunda para: "${payload?.query}". Foque no contexto original e filologia.`,
          config: {
            systemInstruction: "Você é um professor de exegese bíblica. Responda APENAS com JSON puro seguindo o schema fornecido. Seja acadêmico e preciso.",
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
                    }
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
          body: exegesisRes.text 
        };

      case 'generateImage':
        const imgRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `Cinematic biblical historical reconstruction, high detail, 4k: ${payload?.prompt}` }] }
        });
        const img = imgRes.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ base64: img?.inlineData?.data || "" }) 
        };

      case 'generateTTS':
        const ttsRes = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: payload?.text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { 
              voiceConfig: { 
                prebuiltVoiceConfig: { voiceName: payload?.voice || 'Kore' } 
              } 
            }
          }
        });
        const audio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ base64: audio || "" }) 
        };

      default:
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: 'Ação desconhecida.' }) 
        };
    }
  } catch (err: any) {
    console.error("Erro na função exegesis:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro interno no servidor.', 
        message: err.message 
      }),
    };
  }
};