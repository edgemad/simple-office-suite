import type { AppSettings } from '../types';

export interface AiTaskResult {
  content: string;
  explanation?: string;
  suggestedAction?: string;
}

export async function processAiRequest(
  task: string,
  context: string,
  settings?: AppSettings
): Promise<string> {
  const provider = settings?.aiProvider || 'gemini';

  // 1. Google Gemini API
  if (provider === 'gemini' || !provider) {
    if (!settings?.aiApiKey || !settings.aiApiKey.trim()) {
      return `⚠️ **Google Gemini API Key Required**\n\nLive AI generation requires an official Google Gemini API Key:\n\n1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey)\n2. Open **Settings** (⌘,) → **AI Configuration** (or paste it in the Gemini setup box)\n3. Paste your key and click **Save**\n\nOnce configured, Gemini will generate live content, analyze documents, write formulas, and build slides.`;
    }

    try {
      const model = settings.aiModel || 'gemini-1.5-flash';
      const cleanModel = model.replace(/^models\//, '');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(settings.aiApiKey.trim())}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are Google Gemini in an office productivity suite (Docs, Sheets, Slides, Forms, Files).
Assist the user with writing, summarizing, spreadsheet modeling, formulas, slide generation, or document analysis.
Provide high-quality, concise, beautifully formatted output in markdown or clean text as requested.

Task: ${task}

Context/Input:
${context}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: settings.aiTemperature ?? 0.7,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text.trim();
        return 'Gemini generated an empty response.';
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        return `❌ **Google Gemini API Error (${res.status})**:\n${errMsg}\n\nPlease verify your API key in **Settings** (⌘,) → **AI Configuration**.`;
      }
    } catch (err: any) {
      return `❌ **Network Error connecting to Google Gemini**:\n${err.message || err}\n\nPlease check your internet connection.`;
    }
  }

  // 2. OpenAI API
  if (provider === 'openai') {
    if (!settings?.aiApiKey || !settings.aiApiKey.trim()) {
      return `⚠️ **OpenAI API Key Required**\n\nPlease enter your OpenAI API key in **Settings** (⌘,) → **AI Configuration**.`;
    }
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.aiApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: settings.aiModel || 'gpt-4o',
          temperature: settings.aiTemperature ?? 0.7,
          messages: [
            {
              role: 'system',
              content:
                'You are an office AI assistant. Provide high-quality, concise, professional office content formatted in clean markdown or plain text as requested.',
            },
            {
              role: 'user',
              content: `Task: ${task}\n\nContext/Input:\n${context}`,
            },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'No response generated.';
      } else {
        const errJson = await res.json().catch(() => ({}));
        return `❌ **OpenAI API Error (${res.status})**: ${errJson?.error?.message || res.statusText}`;
      }
    } catch (err: any) {
      return `❌ **Network Error**: ${err.message || err}`;
    }
  }

  // 3. Anthropic Claude API
  if (provider === 'anthropic') {
    if (!settings?.aiApiKey || !settings.aiApiKey.trim()) {
      return `⚠️ **Anthropic Claude API Key Required**\n\nPlease enter your Claude API key in **Settings** (⌘,) → **AI Configuration**.`;
    }
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.aiApiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings.aiModel || 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          temperature: settings.aiTemperature ?? 0.7,
          messages: [
            {
              role: 'user',
              content: `Task: ${task}\n\nContext:\n${context}`,
            },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.content?.[0]?.text || 'No response generated.';
      } else {
        const errJson = await res.json().catch(() => ({}));
        return `❌ **Anthropic API Error (${res.status})**: ${errJson?.error?.message || res.statusText}`;
      }
    } catch (err: any) {
      return `❌ **Network Error**: ${err.message || err}`;
    }
  }

  // 4. Ollama (Local LLM)
  if (provider === 'ollama') {
    const url = settings?.aiApiKey || 'http://localhost:11434';
    try {
      const res = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings?.aiModel || 'llama3.2',
          prompt: `Task: ${task}\n\nContext:\n${context}`,
          stream: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.response || 'No response generated.';
      } else {
        return `❌ **Ollama Connection Error (${res.status})**: Failed to communicate with Ollama at ${url}`;
      }
    } catch (err: any) {
      return `❌ **Ollama Not Reachable**: Could not connect to local Ollama server at ${url}. Ensure Ollama is running (\`ollama serve\`).`;
    }
  }

  return 'No AI provider configured.';
}
