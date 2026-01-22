import OpenAI from 'openai';
import { config } from './config';

export interface EmbeddingResult {
  embedding: number[];
  text: string;
}

export async function embedText(text: string): Promise<number[]> {
  if (!config.openaiApiKey && !config.geminiApiKey) {
    throw new Error('No AI API key is set');
  }

  const provider =
    config.embeddingProvider ||
    (config.geminiApiKey && !config.openaiApiKey ? 'gemini' : 'openai');

  if (provider === 'gemini') {
    if (!config.geminiApiKey) {
      throw new Error('EMBEDDING_PROVIDER is set to gemini but GEMINI_API_KEY is missing');
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiEmbeddingModel}:embedContent?key=${config.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text }] },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini embedding error: ${errorText}`);
    }

    const data = (await response.json()) as {
      embedding?: { values?: number[] };
    };
    const values = data.embedding?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('Gemini embedding response is missing values');
    }

    return values;
  }

  if (!config.openaiApiKey) {
    throw new Error('EMBEDDING_PROVIDER is set to openai but OPENAI_API_KEY is missing');
  }

  const openai = new OpenAI({ apiKey: config.openaiApiKey });

  const response = await openai.embeddings.create({
    model: config.embeddingModel,
    input: text,
  });

  return response.data[0].embedding;
}

export async function embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
  if (!config.openaiApiKey && !config.geminiApiKey) {
    throw new Error('No AI API key is set');
  }

  const provider =
    config.embeddingProvider ||
    (config.geminiApiKey && !config.openaiApiKey ? 'gemini' : 'openai');

  if (provider === 'gemini') {
    if (!config.geminiApiKey) {
      throw new Error('EMBEDDING_PROVIDER is set to gemini but GEMINI_API_KEY is missing');
    }
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      const embedding = await embedText(text);
      results.push({ embedding, text });
    }
    return results;
  }

  if (!config.openaiApiKey) {
    throw new Error('EMBEDDING_PROVIDER is set to openai but OPENAI_API_KEY is missing');
  }

  const openai = new OpenAI({
    apiKey: config.openaiApiKey,
  });

  const response = await openai.embeddings.create({
    model: config.embeddingModel,
    input: texts,
  });

  return response.data.map((item: { embedding: number[] }, index: number) => ({
    embedding: item.embedding,
    text: texts[index],
  }));
}
