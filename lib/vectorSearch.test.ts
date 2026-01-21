import { cosineSimilarity, findTopSimilar, KeywordIndex } from './vectorSearch';

describe('vectorSearch', () => {
  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vecA = [1, 0, 0];
      const vecB = [1, 0, 0];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0, 5);
    });

    it('should handle negative similarities', () => {
      const vecA = [1, 0, 0];
      const vecB = [-1, 0, 0];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1, 5);
    });

    it('should throw error for different length vectors', () => {
      const vecA = [1, 0];
      const vecB = [1, 0, 0];
      expect(() => cosineSimilarity(vecA, vecB)).toThrow();
    });
  });

  describe('findTopSimilar', () => {
    const mockIndex: KeywordIndex = {
      keywords: [
        {
          keyword: 'keyword1',
          path: ['test'],
          embedding: [1, 0, 0],
        },
        {
          keyword: 'keyword2',
          path: ['test'],
          embedding: [0, 1, 0],
        },
        {
          keyword: 'keyword3',
          path: ['test'],
          embedding: [0, 0, 1],
        },
        {
          keyword: 'keyword4',
          path: ['test'],
          embedding: [0.9, 0.1, 0],
        },
      ],
    };

    it('should return top N similar keywords', () => {
      const queryEmbedding = [1, 0, 0];
      const results = findTopSimilar(queryEmbedding, mockIndex, 2);
      expect(results).toHaveLength(2);
      expect(results[0].keyword).toBe('keyword1');
      expect(results[1].keyword).toBe('keyword4');
    });

    it('should return all keywords if topN exceeds available', () => {
      const queryEmbedding = [1, 0, 0];
      const results = findTopSimilar(queryEmbedding, mockIndex, 10);
      expect(results).toHaveLength(4);
    });

    it('should handle empty index', () => {
      const emptyIndex: KeywordIndex = { keywords: [] };
      const queryEmbedding = [1, 0, 0];
      const results = findTopSimilar(queryEmbedding, emptyIndex, 5);
      expect(results).toHaveLength(0);
    });
  });
});
