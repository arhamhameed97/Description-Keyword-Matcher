import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    ai: {
      openai: {
        configured: Boolean(config.openaiApiKey),
        model: config.llmModel,
        embeddingModel: config.embeddingModel,
      },
      gemini: {
        configured: Boolean(config.geminiApiKey),
        apiVersion: config.geminiApiVersion,
        llmModel: config.geminiLlmModel,
        embeddingModel: config.geminiEmbeddingModel,
      },
      openrouter: {
        configured: Boolean(config.openrouterApiKey),
        model: config.openrouterModel,
      },
    },
  });
}
