import {
  validateKeywords,
  getAllowedKeywordsSet,
  extractKeywordsFromLLMResponse,
} from './validators';
import { KeywordEntry } from './vectorSearch';

describe('validators', () => {
  describe('getAllowedKeywordsSet', () => {
    it('should create a set of all keywords', () => {
      const index = {
        keywords: [
          { keyword: 'keyword1', path: ['test'], embedding: [1, 0, 0] },
          { keyword: 'keyword2', path: ['test'], embedding: [0, 1, 0] },
        ] as KeywordEntry[],
      };
      const allowedSet = getAllowedKeywordsSet(index);
      expect(allowedSet.has('keyword1')).toBe(true);
      expect(allowedSet.has('keyword2')).toBe(true);
      expect(allowedSet.has('invalid')).toBe(false);
    });
  });

  describe('validateKeywords', () => {
    it('should filter out invalid keywords', () => {
      const allowedSet = new Set(['keyword1', 'keyword2', 'keyword3']);
      const candidates = ['keyword1', 'invalid', 'keyword2', 'also-invalid'];
      const validated = validateKeywords(candidates, allowedSet);
      expect(validated).toEqual(['keyword1', 'keyword2']);
    });

    it('should return empty array if no keywords are valid', () => {
      const allowedSet = new Set(['keyword1']);
      const candidates = ['invalid1', 'invalid2'];
      const validated = validateKeywords(candidates, allowedSet);
      expect(validated).toEqual([]);
    });

    it('should return all keywords if all are valid', () => {
      const allowedSet = new Set(['keyword1', 'keyword2']);
      const candidates = ['keyword1', 'keyword2'];
      const validated = validateKeywords(candidates, allowedSet);
      expect(validated).toEqual(['keyword1', 'keyword2']);
    });
  });

  describe('extractKeywordsFromLLMResponse', () => {
    it('should extract keywords from JSON array', () => {
      const response = '["keyword1", "keyword2", "keyword3"]';
      const keywords = extractKeywordsFromLLMResponse(response);
      expect(keywords).toEqual(['keyword1', 'keyword2', 'keyword3']);
    });

    it('should extract keywords from JSON object with keywords array', () => {
      const response = '{"keywords": ["keyword1", "keyword2"]}';
      const keywords = extractKeywordsFromLLMResponse(response);
      expect(keywords).toEqual(['keyword1', 'keyword2']);
    });

    it('should extract keywords from comma-separated list', () => {
      const response = 'keyword1, keyword2, keyword3';
      const keywords = extractKeywordsFromLLMResponse(response);
      expect(keywords).toEqual(['keyword1', 'keyword2', 'keyword3']);
    });

    it('should extract keywords from newline-separated list', () => {
      const response = 'keyword1\nkeyword2\nkeyword3';
      const keywords = extractKeywordsFromLLMResponse(response);
      expect(keywords).toEqual(['keyword1', 'keyword2', 'keyword3']);
    });

    it('should handle mixed separators', () => {
      const response = 'keyword1, keyword2\nkeyword3';
      const keywords = extractKeywordsFromLLMResponse(response);
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('should filter out empty strings', () => {
      const response = 'keyword1, , keyword2,  ';
      const keywords = extractKeywordsFromLLMResponse(response);
      expect(keywords).toEqual(['keyword1', 'keyword2']);
    });
  });
});
