import { GoogleGenAI, Type, Modality } from "@google/genai";

export const handler = async (event: any) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuração Incompleta', details: 'A chave API_KEY não foi configurada no ambiente do servidor.' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, payload } = body;
    
    const ai = new GoogleGenAI({ apiKey });

    switch (action) {
      case 'getExegesis':
        // Usamos Flash para velocidade em ambiente serverless (evita timeout de 10s)
        const exegesisRes = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Realize uma exegese bíblica acadêmica e histórica profunda sobre: "${payload?.query}". 
          Forneça contexto sociopolítico, termos no original e implicações teológicas.`,
          config: {
            systemInstruction: "Você é um professor de exegese bíblica acadêmica. Responda estritamente em JSON puro, sem formatação markdown.",
            responseMimeType: "application/json",
            temperature: 0.7,
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
                    required: ["term", "transliteration", "meaning"]
                  }
                },
                imagePrompt: { type: Type.STRING },
              },
              required: ["verse", "context", "historicalAnalysis", "theologicalInsights", "originalLanguages", "imagePrompt"],
            }
          }
        });
        
        const text = exegesisRes.text;
        if (!text) throw new Error("A IA retornou uma resposta vazia.");

        return { 
          statusCode: 200, 
          headers, 
          body: text 
        };

      case 'generateImage':
        const imgRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `Biblical historical reconstruction, cinematic, cinematic lighting, 8k, archaeological accuracy: ${payload?.prompt}` }] },
          config: {
            imageConfig: { aspectRatio: "16:9" }
          }
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
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ação Inválida' }) };
    }
  } catch (err: any) {
    console.error("Erro Crítico na API:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Falha na Análise', 
        details: err.message || 'Erro desconhecido'
      }),
    };
  }
};