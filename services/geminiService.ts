import { GoogleGenAI, Type } from "@google/genai";
import { ChartOfAccountItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Helper to check if API key is set
const isApiKeyAvailable = (): boolean => !!process.env.API_KEY;

export const categorizeTransaction = async (description: string, accounts: ChartOfAccountItem[]): Promise<string | null> => {
  if (!isApiKeyAvailable()) {
    console.warn("Gemini API key not found. Skipping smart categorization.");
    return null;
  }

  const model = "gemini-2.5-flash";
  
  // Create a simplified list of codes for the model from the passed accounts
  const codes = accounts.filter(c => !c.isHeader).map(c => `${c.code}: ${c.category}`).join("\n");

  const prompt = `
    You are an accounting assistant. Given the following Chart of Accounts:
    ${codes}

    And the following transaction description: "${description}"

    Identify the most likely account code. Return ONLY the code as a string (e.g., "1.6.5 h"). If unsure, return "UNKNOWN".
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    const text = response.text?.trim();
    if (text && text !== "UNKNOWN") {
      return text;
    }
    return null;
  } catch (error) {
    console.error("Gemini categorization failed:", error);
    return null;
  }
};

export const analyzeVariance = async (varianceData: any): Promise<string> => {
    if (!isApiKeyAvailable()) return "AI analysis unavailable (Missing API Key).";

    const prompt = `
      Analyze the following financial variance data for an NGO. 
      Identify top 3 over-budget areas and provide a brief executive summary of financial health.
      Data: ${JSON.stringify(varianceData)}
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      return response.text || "No analysis generated.";
    } catch (error) {
      console.error(error);
      return "Error generating analysis.";
    }
};

export const parseBankStatementLines = async (rawText: string): Promise<any[]> => {
    if (!isApiKeyAvailable()) return [];

    const prompt = `
      Parse the following raw text from a bank statement into a JSON array of objects.
      Each object should have: 'date' (YYYY-MM-DD), 'description', 'amount' (number, negative for debit, positive for credit).
      
      Raw Text:
      ${rawText.substring(0, 3000)} 
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER }
              }
            }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error(error);
      return [];
    }
}