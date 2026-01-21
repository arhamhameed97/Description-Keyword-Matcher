import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { embedText } from '@/lib/embeddings';
import { findTopSimilar, KeywordIndex } from '@/lib/vectorSearch';
import { validateKeywords, getAllowedKeywordsSet, extractKeywordsFromLLMResponse } from '@/lib/validators';
import { config } from '@/lib/config';
import { recordUsage } from '@/lib/usageTracker';

let keywordIndexCache: KeywordIndex | null = null;

function getClientId(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || forwardedFor;
  }
  const realIp = request.headers.get('x-real-ip');
  return realIp || 'unknown';
}

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

function buildKeywordIndexFromKeywords(): KeywordIndex {
  const projectRoot = getProjectRoot();
  const keywordsPath = path.resolve(projectRoot, config.keywordsPath);
  if (!fs.existsSync(keywordsPath)) {
    throw new Error(
      `Keywords file not found at ${keywordsPath}. Please ensure the keywords file exists.`
    );
  }

  const keywordsData = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8')) as {
    keywords: Array<{ keyword: string; path: string[] }>;
  };

  return {
    keywords: keywordsData.keywords.map((k) => ({
      keyword: k.keyword,
      path: k.path,
      embedding: [],
    })),
  };
}

function loadKeywordIndex(): KeywordIndex {
  if (keywordIndexCache) {
    return keywordIndexCache;
  }

  const projectRoot = getProjectRoot();
  const indexPath = path.resolve(projectRoot, config.keywordIndexPath);
  if (!fs.existsSync(indexPath)) {
    if (!config.openaiApiKey) {
      keywordIndexCache = buildKeywordIndexFromKeywords();
      return keywordIndexCache;
    }

    throw new Error(
      'Keyword index not found. Please run: npm run build-keyword-index'
    );
  }

  const indexData = fs.readFileSync(indexPath, 'utf-8');
  keywordIndexCache = JSON.parse(indexData) as KeywordIndex;

  if (
    (config.openaiApiKey || config.geminiApiKey) &&
    keywordIndexCache.keywords.some(
      (entry) => !entry.embedding || entry.embedding.length === 0
    )
  ) {
    throw new Error(
      'Keyword index is missing embeddings. Rebuild with: npm run build-keyword-index'
    );
  }

  return keywordIndexCache;
}

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientId(request);
    const body = await request.json();
    const { description, useLLM = false, keywordCount, llmProvider } = body;

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Load keyword index
    const keywordIndex = loadKeywordIndex();
    const allowedKeywords = getAllowedKeywordsSet(keywordIndex);

    // If LLM is requested, we require an AI API key.
    if (useLLM && !config.openaiApiKey && !config.geminiApiKey && !config.openrouterApiKey) {
      return NextResponse.json(
        { error: 'No AI API key is configured' },
        { status: 500 }
      );
    }

    // Determine which provider to use for LLM
    let selectedProvider: 'openai' | 'gemini' | 'openrouter' | null = null;
    if (useLLM) {
      if (llmProvider === 'openrouter' && config.openrouterApiKey) {
        selectedProvider = 'openrouter';
      } else if (llmProvider === 'gemini' && config.geminiApiKey) {
        selectedProvider = 'gemini';
      } else if (llmProvider === 'openai' && config.openaiApiKey) {
        selectedProvider = 'openai';
      } else {
        // Auto-select: prefer OpenRouter > Gemini > OpenAI
        if (config.openrouterApiKey) {
          selectedProvider = 'openrouter';
        } else if (config.geminiApiKey) {
          selectedProvider = 'gemini';
        } else if (config.openaiApiKey) {
          selectedProvider = 'openai';
        }
      }
    }

    // If no AI provider is configured and LLM is off, fallback to lexical matching.
    if (!config.openaiApiKey && !config.geminiApiKey && !useLLM) {
      const normalizedDescription = description.toLowerCase();
      const keywordsWithScore = keywordIndex.keywords
        .map((entry) => {
          const keyword = entry.keyword;
          const keywordLower = keyword.toLowerCase();
          let score = 0;

          if (normalizedDescription.includes(keywordLower)) {
            score += 3;
          }

          const keywordWords = keywordLower
            .split(/[^a-z0-9]+/g)
            .filter(Boolean);
          const overlap = keywordWords.filter(
            (word) => word.length > 2 && normalizedDescription.includes(word)
          ).length;
          score += overlap;

          return { keyword, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword));

      const count = keywordCount
        ? Math.min(Math.max(parseInt(String(keywordCount)), 1), 50)
        : config.targetKeywordCount.max;
      const directKeywords = keywordsWithScore
        .map((item) => item.keyword)
        .slice(0, count)
        .filter((k) => allowedKeywords.has(k));

      return NextResponse.json({
        keywords: directKeywords,
        shortlistSize: keywordIndex.keywords.length,
        validatedCount: directKeywords.length,
        method: 'lexical',
      });
    }

    // Step 1: Embed the description
    const descriptionEmbedding = await embedText(description);

    // Step 2: Find top similar keywords using vector search
    const shortlist = findTopSimilar(
      descriptionEmbedding,
      keywordIndex,
      config.shortlistSize
    );

    const shortlistKeywords = shortlist.map((entry) => entry.keyword);

    // Step 3: If LLM is disabled, return top N keywords directly
    if (!useLLM) {
      const count = keywordCount
        ? Math.min(Math.max(parseInt(String(keywordCount)), 1), 50)
        : config.targetKeywordCount.max;
      const directKeywords = shortlistKeywords
        .slice(0, count)
        .filter((k) => allowedKeywords.has(k));

      return NextResponse.json({
        keywords: directKeywords,
        shortlistSize: shortlist.length,
        validatedCount: directKeywords.length,
        method: 'direct',
      });
    }

    // Step 4: Use LLM to select 10-15 keywords from shortlist
    const shortlistText = shortlistKeywords.join(', ');

    const prompt = `You are a movie keyword matcher. Given a movie description and a shortlist of candidate keywords, select 10-15 keywords that best match the description.

Movie Description:
${description}

Candidate Keywords (select from these only):
${shortlistText}

IMPORTANT: You must ONLY select keywords from the candidate list above. Do not invent or modify keywords.

Return your response as a JSON object with a "keywords" array field containing 10-15 selected keywords, like this:
{"keywords": ["Keyword1", "Keyword2", "Keyword3", ...]}

Select exactly 10-15 keywords that best match the movie description.`;

    let llmContent = '';

    if (selectedProvider === 'openrouter') {
      const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Movie Keyword Matcher',
        },
        body: JSON.stringify({
          model: config.openrouterModel,
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant that selects keywords from a provided list. Always return a valid JSON object with a "keywords" array field.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!openrouterResponse.ok) {
        const errorText = await openrouterResponse.text();
        recordUsage({
          provider: 'openrouter',
          model: config.openrouterModel,
          userId: clientId,
        });
        throw new Error(`OpenRouter LLM error: ${errorText}`);
      }

      const openrouterData = await openrouterResponse.json() as {
        choices?: Array<{
          message?: { content?: string };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      if (openrouterData.usage) {
        recordUsage({
          provider: 'openrouter',
          model: config.openrouterModel,
          userId: clientId,
          tokens: {
            promptTokens: openrouterData.usage.prompt_tokens ?? 0,
            outputTokens: openrouterData.usage.completion_tokens ?? 0,
            totalTokens: openrouterData.usage.total_tokens ?? 0,
          },
        });
      } else {
        recordUsage({
          provider: 'openrouter',
          model: config.openrouterModel,
          userId: clientId,
        });
      }

      llmContent = openrouterData.choices?.[0]?.message?.content || '';
    } else if (selectedProvider === 'openai' && config.openaiApiKey) {
      const openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });

      const llmResponse = await openai.chat.completions.create({
        model: config.llmModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that selects keywords from a provided list. Always return a valid JSON object with a "keywords" array field.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      if (llmResponse.usage) {
        recordUsage({
          provider: 'openai',
          model: config.llmModel,
          userId: clientId,
          tokens: {
            promptTokens: llmResponse.usage.prompt_tokens ?? 0,
            outputTokens: llmResponse.usage.completion_tokens ?? 0,
            totalTokens: llmResponse.usage.total_tokens ?? 0,
          },
        });
      } else {
        recordUsage({
          provider: 'openai',
          model: config.llmModel,
          userId: clientId,
        });
      }

      llmContent = llmResponse.choices[0]?.message?.content || '';
    } else if (selectedProvider === 'gemini' && config.geminiApiKey) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/${config.geminiApiVersion}/models/${config.geminiLlmModel}:generateContent?key=${config.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        recordUsage({
          provider: 'gemini',
          model: config.geminiLlmModel,
          userId: clientId,
        });

        const errorText = await geminiResponse.text();
        let retryAfterSeconds: number | null = null;

        try {
          const errorJson = JSON.parse(errorText) as {
            error?: {
              code?: number;
              details?: Array<{
                ['@type']?: string;
                retryDelay?: string;
              }>;
            };
          };
          const retryInfo = errorJson.error?.details?.find(
            (detail) => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
          );
          const retryDelay = retryInfo?.retryDelay;
          if (retryDelay) {
            const match = retryDelay.match(/(\d+)/);
            if (match) {
              retryAfterSeconds = parseInt(match[1], 10);
            }
          }
        } catch {
          // Ignore JSON parsing errors; fall back to raw error text.
        }

        if (geminiResponse.status === 429) {
          return NextResponse.json(
            {
              error:
                'Gemini quota exceeded. Please retry after the suggested delay or check your plan and billing.',
              retryAfterSeconds,
              raw: errorText,
            },
            {
              status: 429,
              headers:
                retryAfterSeconds !== null
                  ? { 'Retry-After': String(retryAfterSeconds) }
                  : undefined,
            }
          );
        }

        throw new Error(`Gemini LLM error: ${errorText}`);
      }

      const geminiData = (await geminiResponse.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      if (geminiData.usageMetadata) {
        recordUsage({
          provider: 'gemini',
          model: config.geminiLlmModel,
          userId: clientId,
          tokens: {
            promptTokens: geminiData.usageMetadata.promptTokenCount ?? 0,
            outputTokens: geminiData.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: geminiData.usageMetadata.totalTokenCount ?? 0,
          },
        });
      } else {
        recordUsage({
          provider: 'gemini',
          model: config.geminiLlmModel,
          userId: clientId,
        });
      }

      llmContent =
        geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    
    // Try to extract keywords from LLM response
    let selectedKeywords: string[] = [];
    
    try {
      const parsed = JSON.parse(llmContent);
      if (Array.isArray(parsed)) {
        selectedKeywords = parsed;
      } else if (parsed.keywords && Array.isArray(parsed.keywords)) {
        selectedKeywords = parsed.keywords;
      } else if (typeof parsed === 'object') {
        // Try to find any array in the response
        const values = Object.values(parsed);
        const arrayValue = values.find((v) => Array.isArray(v));
        if (arrayValue) {
          selectedKeywords = arrayValue as string[];
        }
      }
    } catch {
      // Fallback: try text extraction
      selectedKeywords = extractKeywordsFromLLMResponse(llmContent);
    }

    // Step 4: Validate keywords (ensure they're in the allowed set)
    const validatedKeywords = validateKeywords(selectedKeywords, allowedKeywords);

    // If validation removed too many keywords, fallback to top shortlist keywords
    let finalKeywords: string[];
    if (validatedKeywords.length < config.targetKeywordCount.min) {
      // Fallback: take top keywords from shortlist
      finalKeywords = shortlistKeywords
        .slice(0, config.targetKeywordCount.max)
        .filter((k) => allowedKeywords.has(k));
    } else {
      finalKeywords = validatedKeywords.slice(0, config.targetKeywordCount.max);
    }

    return NextResponse.json({
      keywords: finalKeywords,
      shortlistSize: shortlist.length,
      validatedCount: validatedKeywords.length,
      method: 'llm',
    });
  } catch (error) {
    console.error('Error matching keywords:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'An error occurred while matching keywords',
      },
      { status: 500 }
    );
  }
}
