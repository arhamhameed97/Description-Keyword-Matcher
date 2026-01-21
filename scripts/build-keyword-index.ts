import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { embedTexts } from '../lib/embeddings';
import { KeywordEntry, KeywordIndex } from '../lib/vectorSearch';
import { config } from '../lib/config';

interface KeywordData {
  keywords: Array<{
    keyword: string;
    path: string[];
  }>;
}

async function buildKeywordIndex() {
  console.log('Loading keywords...');
  const keywordsPath = path.resolve(process.cwd(), config.keywordsPath);
  const keywordsData: KeywordData = JSON.parse(
    fs.readFileSync(keywordsPath, 'utf-8')
  );

  console.log(`Found ${keywordsData.keywords.length} keywords`);

  if (!config.openaiApiKey && !config.geminiApiKey) {
    console.warn(
      'No AI API key is set. Building keyword index without embeddings.'
    );

    const keywordIndex: KeywordIndex = {
      keywords: keywordsData.keywords.map((k) => ({
        keyword: k.keyword,
        path: k.path,
        embedding: [],
      })),
    };

    const outputPath = path.resolve(process.cwd(), config.keywordIndexPath);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Writing index to ${outputPath}...`);
    fs.writeFileSync(outputPath, JSON.stringify(keywordIndex, null, 2));
    console.log('Keyword index built successfully (no embeddings).');
    return;
  }

  console.log('Generating embeddings...');
  const keywordTexts = keywordsData.keywords.map((k) => k.keyword);
  
  // Process in batches to avoid rate limits
  const batchSize = 100;
  const embeddings: Array<{ embedding: number[]; text: string }> = [];
  
  for (let i = 0; i < keywordTexts.length; i += batchSize) {
    const batch = keywordTexts.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(keywordTexts.length / batchSize)}`);
    const batchEmbeddings = await embedTexts(batch);
    embeddings.push(...batchEmbeddings);
  }

  console.log('Building keyword index...');
  const keywordIndex: KeywordIndex = {
    keywords: keywordsData.keywords.map((k, index) => {
      const embedding = embeddings.find((e) => e.text === k.keyword);
      if (!embedding) {
        throw new Error(`Missing embedding for keyword: ${k.keyword}`);
      }
      return {
        keyword: k.keyword,
        path: k.path,
        embedding: embedding.embedding,
      };
    }),
  };

  const outputPath = path.resolve(process.cwd(), config.keywordIndexPath);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Writing index to ${outputPath}...`);
  fs.writeFileSync(outputPath, JSON.stringify(keywordIndex, null, 2));
  console.log('Keyword index built successfully!');
}

buildKeywordIndex().catch((error) => {
  console.error('Error building keyword index:', error);
  process.exit(1);
});
