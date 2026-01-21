import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { embedText } from '@/lib/embeddings';
import { findTopSimilar, KeywordIndex } from '@/lib/vectorSearch';
import { config } from '@/lib/config';
import { getUsageSnapshot } from '@/lib/usageTracker';

let keywordIndexCache: KeywordIndex | null = null;

function getProjectRoot(): string {
  // In Vercel/serverless, process.cwd() should work, but let's try multiple strategies
  let root = process.cwd();
  
  // Check if data directory exists at current working directory
  const dataDir = path.join(root, 'data');
  if (fs.existsSync(dataDir)) {
    return root;
  }
  
  // Try walking up from current directory to find package.json
  let currentDir = root;
  for (let i = 0; i < 5; i++) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const dataPath = path.join(currentDir, 'data');
    if (fs.existsSync(packageJsonPath) && fs.existsSync(dataPath)) {
      return currentDir;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  
  // Fallback to process.cwd()
  return process.cwd();
}

function loadKeywordIndex(): KeywordIndex | null {
  if (keywordIndexCache) {
    return keywordIndexCache;
  }

  const projectRoot = getProjectRoot();
  const indexPath = path.resolve(projectRoot, config.keywordIndexPath);
  if (!fs.existsSync(indexPath)) {
    return null;
  }

  const indexData = fs.readFileSync(indexPath, 'utf-8');
  keywordIndexCache = JSON.parse(indexData) as KeywordIndex;
  return keywordIndexCache;
}

// Simple token estimation: ~4 characters per token for English text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, llmProvider } = body;

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Determine which provider/model to estimate for
    let provider: 'gemini' | 'openrouter' | null = null;
    let model = '';

    if (llmProvider === 'openrouter' && config.openrouterApiKey) {
      provider = 'openrouter';
      model = config.openrouterModel;
    } else if (llmProvider === 'gemini' && config.geminiApiKey) {
      provider = 'gemini';
      model = config.geminiLlmModel;
    } else {
      // Auto-select based on available keys
      if (config.openrouterApiKey) {
        provider = 'openrouter';
        model = config.openrouterModel;
      } else if (config.geminiApiKey) {
        provider = 'gemini';
        model = config.geminiLlmModel;
      }
    }

    if (!provider || !model) {
      return NextResponse.json(
        { error: 'No LLM provider available for estimation' },
        { status: 400 }
      );
    }

    // Load keyword index to estimate shortlist
    const keywordIndex = loadKeywordIndex();
    if (!keywordIndex) {
      return NextResponse.json(
        { error: 'Keyword index not available' },
        { status: 500 }
      );
    }

    // Estimate shortlist (same logic as match endpoint)
    let shortlistKeywords: string[] = [];
    try {
      const descriptionEmbedding = await embedText(description);
      const shortlist = findTopSimilar(
        descriptionEmbedding,
        keywordIndex,
        config.shortlistSize
      );
      shortlistKeywords = shortlist.map((entry) => entry.keyword);
    } catch (error) {
      // If embedding fails, estimate based on average shortlist size
      shortlistKeywords = Array(config.shortlistSize).fill('keyword');
    }

    const shortlistText = shortlistKeywords.join(', ');

    // Build the prompt (same as match endpoint)
    const prompt = `You are a movie keyword matcher. Given a movie description and a shortlist of candidate keywords, select 10-15 keywords that best match the description.

Movie Description:
${description}

Candidate Keywords (select from these only):
${shortlistText}

IMPORTANT: You must ONLY select keywords from the candidate list above. Do not invent or modify keywords.

Return your response as a JSON object with a "keywords" array field containing 10-15 selected keywords, like this:
{"keywords": ["Keyword1", "Keyword2", "Keyword3", ...]}

Select exactly 10-15 keywords that best match the movie description.`;

    const systemPrompt = 'You are a helpful assistant that selects keywords from a provided list. Always return a valid JSON object with a "keywords" array field.';

    // Estimate tokens
    const promptTokens = estimateTokens(systemPrompt + '\n\n' + prompt);
    // Estimate output: JSON with 10-15 keywords, roughly 20-30 tokens
    const estimatedOutputTokens = 30;
    const estimatedTotalTokens = promptTokens + estimatedOutputTokens;

    // Get current usage for this provider/model
    const usageSnapshot = getUsageSnapshot();
    const providerUsage = usageSnapshot.providers[provider];
    const modelUsage = providerUsage?.models[model] || {
      requests: 0,
      tokens: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
    };

    return NextResponse.json({
      provider,
      model,
      estimates: {
        promptTokens,
        outputTokens: estimatedOutputTokens,
        totalTokens: estimatedTotalTokens,
      },
      currentUsage: {
        requests: modelUsage.requests,
        tokens: modelUsage.tokens,
      },
      overUsage: null, // Limits not configured
    });
  } catch (error) {
    console.error('Error estimating tokens:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'An error occurred while estimating tokens',
      },
      { status: 500 }
    );
  }
}
