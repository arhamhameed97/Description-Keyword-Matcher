# Movie Keyword Matcher

A Next.js web application that matches movie descriptions to keywords from a comprehensive taxonomy using a hybrid approach of semantic embeddings and LLM-based selection.

## Features

- **Hybrid Matching**: Uses vector embeddings for initial shortlisting and LLM for final keyword selection
- **Comprehensive Taxonomy**: Based on the XMind keyword space with hundreds of keywords across multiple categories
- **Smart Validation**: Ensures all returned keywords are from the allowed taxonomy
- **Modern UI**: Clean, black/white/grey themed interface

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   EMBEDDING_MODEL=text-embedding-3-small
   LLM_MODEL=gpt-4o-mini
   SHORTLIST_SIZE=50
   ```

3. **Build the keyword index**:
   Before running the app, you need to generate embeddings for all keywords:
   ```bash
   npm run build-keyword-index
   ```
   This will create `data/keyword-index.json` with precomputed embeddings.

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## How It Works

1. **User Input**: Enter a movie description in the text area
2. **Embedding**: The description is converted to a vector embedding
3. **Vector Search**: Top N similar keywords are found using cosine similarity
4. **LLM Selection**: An LLM selects 10-15 keywords from the shortlist
5. **Validation**: Keywords are validated against the allowed taxonomy
6. **Results**: Displayed keywords are guaranteed to be from the taxonomy

## Project Structure

```
├── app/
│   ├── api/
│   │   └── match/
│   │       └── route.ts          # API endpoint for keyword matching
│   ├── page.tsx                   # Main UI component
│   ├── layout.tsx                 # Root layout
│   └── globals.css               # Global styles
├── lib/
│   ├── config.ts                 # Configuration
│   ├── embeddings.ts             # Embedding utilities
│   ├── vectorSearch.ts           # Vector search functions
│   ├── validators.ts             # Keyword validation
│   ├── vectorSearch.test.ts      # Tests for vector search
│   └── validators.test.ts        # Tests for validators
├── data/
│   ├── keywords.json             # Keyword taxonomy
│   └── keyword-index.json       # Generated embedding index
└── scripts/
    └── build-keyword-index.ts    # Script to build keyword index
```

## Testing

Run tests with:
```bash
npm test
```

## Environment Variables

- `OPENAI_API_KEY` (required): Your OpenAI API key
- `EMBEDDING_MODEL` (optional): Model for embeddings (default: `text-embedding-3-small`)
- `LLM_MODEL` (optional): Model for LLM selection (default: `gpt-4o-mini`)
- `SHORTLIST_SIZE` (optional): Number of keywords to shortlist (default: `50`)

## Notes

- The keyword taxonomy is sourced from the XMind keyword space
- All returned keywords are guaranteed to be from the allowed taxonomy
- The keyword index must be rebuilt if the taxonomy changes
- The app uses a hybrid approach: embeddings for speed, LLM for accuracy
