const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export class GeminiService {
  private async makeRequest(prompt: string): Promise<string> {
    console.log('API Key:', GEMINI_API_KEY ? 'Present' : 'Missing');
    
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is missing');
    }
    
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', response.status, errorText);
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || 'No response generated';
  }

  async summarize(text: string): Promise<string> {
    const prompt = `Please provide a concise summary of the following text:\n\n${text}`;
    return this.makeRequest(prompt);
  }

  async fixGrammar(text: string): Promise<string> {
    const prompt = `Please fix the grammar and spelling in the following text while maintaining its original meaning and tone:\n\n${text}`;
    return this.makeRequest(prompt);
  }

  async improveWriting(text: string): Promise<string> {
    const prompt = `Please improve the clarity and flow of the following text while keeping the same meaning:\n\n${text}`;
    return this.makeRequest(prompt);
  }

  async expandText(text: string): Promise<string> {
    const prompt = `Please expand on the following text with more details and examples:\n\n${text}`;
    return this.makeRequest(prompt);
  }

  async makeItProfessional(text: string): Promise<string> {
    const prompt = `Please rewrite the following text in a more professional tone:\n\n${text}`;
    return this.makeRequest(prompt);
  }
}

export const geminiService = new GeminiService();