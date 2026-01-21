import { EmbeddingResult } from './embeddings';
import { config } from './config';

export interface KeywordEntry {
  keyword: string;
  path: string[];
  embedding: number[];
}

export interface KeywordIndex {
  keywords: KeywordEntry[];
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

export function findTopSimilar(
  queryEmbedding: number[],
  keywordIndex: KeywordIndex,
  topN: number = config.shortlistSize
): KeywordEntry[] {
  const similarities = keywordIndex.keywords.map((entry) => ({
    entry,
    similarity: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, topN).map((item) => item.entry);
}
