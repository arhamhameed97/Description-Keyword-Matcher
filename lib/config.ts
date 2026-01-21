export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  geminiEmbeddingModel:
    process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
  llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  geminiLlmModel: process.env.GEMINI_LLM_MODEL || 'gemini-2.0-flash',
  openrouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  geminiApiVersion: process.env.GEMINI_API_VERSION || 'v1',
  shortlistSize: parseInt(process.env.SHORTLIST_SIZE || '50', 10),
  targetKeywordCount: {
    min: 10,
    max: 15,
  },
  keywordIndexPath: './data/keyword-index.json',
  keywordsPath: './data/keywords.json',
};
