import { GoogleGenAI, Type, Modality } from "@google/genai";

/**
 * Handler para Netlify Functions.
 * O arquivo api/exegesis.ts se torna a função "exegesis".
 */
export const handler = async (event: any) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  // Preflight para CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Apenas POST é aceito
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido.' }),
    };
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY não configurada no Netlify");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuração ausente: API_KEY no ambiente.' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, payload } = body;
    
    // Inicializa o cliente Gemini
    const ai = new GoogleGenAI({ apiKey });

    switch (action) {
      case 'getExegesis':
        const exegesisRes = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Forneça uma exegese técnica e histórica profunda sobre: "${payload?.query}". Foque na cultura da época e línguas originais.`,
          config: {
            systemInstruction: "Você é um perito acadêmico em exegese bíblica e arqueologia. Responda APENAS com JSON puro seguindo o esquema estruturado.",
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
          body: exegesisRes.text || "{}" 
        };

      case 'generateImage':
        const imgRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `Reconstrução histórica bíblica cinematográfica: ${payload?.prompt}` }] }
        });
        const imgPart = imgRes.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ base64: imgPart?.inlineData?.data || "" }) 
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
        const audioData = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ base64: audioData || "" }) 
        };

      default:
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: 'Ação inválida.' }) 
        };
    }
  } catch (err: any) {
    console.error("Erro na função:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro no processamento da IA', 
        details: err.message 
      }),
    };
  }
};