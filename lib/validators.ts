import { KeywordEntry } from './vectorSearch';

export function validateKeywords(
  candidateKeywords: string[],
  allowedKeywords: Set<string>
): string[] {
  return candidateKeywords.filter((keyword) => allowedKeywords.has(keyword));
}

export function getAllowedKeywordsSet(keywordIndex: { keywords: KeywordEntry[] }): Set<string> {
  return new Set(keywordIndex.keywords.map((entry) => entry.keyword));
}

export function extractKeywordsFromLLMResponse(response: string): string[] {
  // Try to extract keywords from various response formats
  // Handle JSON arrays, comma-separated lists, or newline-separated lists
  
  // Try JSON array first
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
    if (parsed.keywords && Array.isArray(parsed.keywords)) {
      return parsed.keywords.map((item: any) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Not JSON, continue with other formats
  }

  // Try comma-separated or newline-separated
  const lines = response.split(/[,\n]/);
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('[') && !line.startsWith('{'));
}
