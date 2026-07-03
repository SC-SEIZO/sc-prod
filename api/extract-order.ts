import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

// POST /api/extract-order
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileData, mimeType } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API is not configured on the server.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const imagePart = {
      inlineData: { mimeType: mimeType, data: fileData },
    };

    const prompt = `
      You are a highly capable AI assistant that extracts data from manufacturing order documents (SPK, PO, Forecast files).
      Extract a list of orders based on the document provided.
      Identify the following fields for each order found:
      - customer: Name of the customer
      - modelGroup: The model group or part series
      - partName: Determine a reasonable automotive part name if not explicitly stated
      - volume: Production volume or quantity requested (number)
      - qtyDay: Reasonable daily running quantity based on volume divided by approx 20 working days
      - homeMachine: Assign an appropriate machine (e.g. #1, #2 for smaller trims, #5 for mid, #8 for large bumpers)
      - tonnage: Intelligently estimate the injection machine tonnage required (e.g. 1300T, 2500T, 3500T)

      If you cannot determine the volume, default to 0.
      If you cannot determine the customer or model, use "Unknown".
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              customer: { type: Type.STRING },
              modelGroup: { type: Type.STRING },
              partName: { type: Type.STRING },
              volume: { type: Type.INTEGER },
              qtyDay: { type: Type.INTEGER },
              homeMachine: { type: Type.STRING },
              tonnage: { type: Type.STRING }
            },
            required: ['customer', 'modelGroup', 'partName', 'volume', 'qtyDay', 'homeMachine', 'tonnage']
          }
        }
      }
    });

    const textOutput = response.text || '[]';
    let orders = [];
    try {
      orders = JSON.parse(textOutput);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI output', raw: textOutput });
    }

    return res.json({ success: true, orders });
  } catch (error: any) {
    console.error('Extraction error:', error);
    return res.status(500).json({ error: error.message || 'Error processing document with AI' });
  }
}
