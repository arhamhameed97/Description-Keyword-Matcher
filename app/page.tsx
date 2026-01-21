'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface KeywordResult {
  keyword: string;
  path?: string[];
}

interface UsageEstimate {
  provider: string;
  model: string;
  estimates: {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  currentUsage: {
    requests: number;
    tokens: {
      promptTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
  overUsage: null | number;
}

export default function Home() {
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState<KeywordResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useLLM, setUseLLM] = useState(false);
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [keywordCount, setKeywordCount] = useState(12);
  const [showSettings, setShowSettings] = useState(true);
  const [shortlistSize, setShortlistSize] = useState<number | null>(null);
  const [usageEstimate, setUsageEstimate] = useState<UsageEstimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  // Fetch usage estimate when description or provider changes (debounced)
  useEffect(() => {
    if (!useLLM || !description.trim()) {
      setUsageEstimate(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      setLoadingEstimate(true);
      fetch('/api/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          llmProvider,
        }),
      })
        .then((res) => {
          if (res.ok) {
            return res.json();
          }
          throw new Error('Failed to fetch estimate');
        })
        .then((data) => {
          setUsageEstimate(data);
        })
        .catch((err) => {
          console.error('Error fetching estimate:', err);
          setUsageEstimate(null);
        })
        .finally(() => {
          setLoadingEstimate(false);
        });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [description, llmProvider, useLLM]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please enter a movie description');
      return;
    }

    setLoading(true);
    setError(null);
    setKeywords([]);
    setShortlistSize(null);

    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          useLLM,
          llmProvider: useLLM ? llmProvider : undefined,
          keywordCount: useLLM ? undefined : keywordCount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to match keywords');
      }

      const data = await response.json();
      setKeywords(
        (data.keywords || []).map((k: string) => ({ keyword: k }))
      );
      setShortlistSize(data.shortlistSize || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="w-full min-h-screen flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 relative z-10">
        <div className="w-full max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Movie Keyword Matcher
            </h1>
            <p className="text-purple-200 text-lg sm:text-xl lg:text-2xl font-light px-4">
              Match movie descriptions to keywords using AI-powered semantic search
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 w-full">
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-6 w-full">
            {/* Input Card */}
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6 shadow-2xl hover:border-purple-500/50 transition-all">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-bold mb-3 text-purple-300 uppercase tracking-wide"
                  >
                    Movie Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter a movie description or synopsis..."
                    className="w-full p-4 bg-slate-900/80 border-2 border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[220px] resize-y transition-all font-medium"
                    disabled={loading}
                  />
                  <div className="mt-2 text-xs text-purple-400 font-medium">
                    {description.length} characters
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !description.trim()}
                  className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/50 text-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg
                        className="animate-spin h-6 w-6"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Matching Keywords...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Match Keywords
                    </span>
                  )}
                </button>
              </form>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/40 border-2 border-red-500/50 rounded-xl p-5 text-red-100 backdrop-blur-md shadow-lg">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-6 h-6 mt-0.5 flex-shrink-0 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <div className="font-bold mb-1 text-lg">Error</div>
                    <div className="text-sm">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Card */}
            {keywords.length > 0 && (
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-md border-2 border-blue-500/30 rounded-2xl p-6 shadow-2xl hover:border-blue-500/50 transition-all">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    Matched Keywords
                    <span className="ml-3 text-xl font-normal text-purple-300">
                      ({keywords.length})
                    </span>
                  </h2>
                  {shortlistSize && (
                    <span className="text-xs font-semibold text-cyan-300 bg-blue-500/20 px-3 py-1.5 rounded-full border border-blue-500/30">
                      From {shortlistSize} candidates
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {keywords.map((item, index) => {
                    const colors = [
                      'from-purple-500 to-pink-500',
                      'from-blue-500 to-cyan-500',
                      'from-pink-500 to-rose-500',
                      'from-indigo-500 to-purple-500',
                      'from-cyan-500 to-blue-500',
                    ];
                    const colorClass = colors[index % colors.length];
                    return (
                      <span
                        key={index}
                        className={`px-4 py-2.5 bg-gradient-to-r ${colorClass} text-white rounded-xl text-sm font-semibold hover:scale-110 transition-transform cursor-default shadow-lg border border-white/20`}
                      >
                        {item.keyword}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            </div>

          {/* Settings Sidebar */}
          <div className="lg:col-span-1 w-full">
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-md border-2 border-purple-500/30 rounded-2xl p-6 shadow-2xl sticky top-6 lg:top-8 h-fit w-full">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Settings
                </h3>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-purple-400 hover:text-purple-300 transition-colors p-2 hover:bg-purple-500/20 rounded-lg"
                  aria-label="Toggle settings"
                >
                  <svg
                    className={`w-6 h-6 transition-transform ${
                      showSettings ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              <div
                className={`space-y-6 transition-all overflow-hidden ${
                  showSettings ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                {/* LLM Toggle */}
                <div className="space-y-3 p-4 bg-slate-900/50 rounded-xl border border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <label
                        htmlFor="useLLM"
                        className="block text-sm font-bold text-purple-300 mb-1"
                      >
                        Use LLM Refinement
                      </label>
                      <p className="text-xs text-purple-400/80">
                        {useLLM
                          ? 'AI will intelligently select keywords'
                          : 'Return top matches directly'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseLLM(!useLLM)}
                      className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${
                        useLLM
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg shadow-purple-500/50'
                          : 'bg-slate-700'
                      }`}
                      role="switch"
                      aria-checked={useLLM}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-lg ${
                          useLLM ? 'translate-x-9' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Provider Selection (only when LLM is on) */}
                {useLLM && (
                  <div className="space-y-3 p-4 bg-slate-900/50 rounded-xl border border-cyan-500/20">
                    <label
                      htmlFor="llmProvider"
                      className="block text-sm font-bold text-cyan-300 mb-2"
                    >
                      LLM Provider
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setLlmProvider('gemini')}
                        className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                          llmProvider === 'gemini'
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/50'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        Gemini
                      </button>
                      <button
                        type="button"
                        onClick={() => setLlmProvider('openrouter')}
                        className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                          llmProvider === 'openrouter'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        OpenRouter
                      </button>
                    </div>
                    <p className="text-xs text-cyan-400/80">
                      Select which AI provider to use
                    </p>
                  </div>
                )}

                {/* Usage Preview (only when LLM is on) */}
                {useLLM && description.trim() && (
                  <div className="space-y-3 p-4 bg-slate-900/50 rounded-xl border border-yellow-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-bold text-yellow-300">
                        Usage Preview
                      </label>
                      {loadingEstimate && (
                        <svg
                          className="animate-spin h-4 w-4 text-yellow-400"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      )}
                    </div>
                    {usageEstimate ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between text-yellow-200">
                          <span>Provider:</span>
                          <span className="font-semibold">{usageEstimate.provider}</span>
                        </div>
                        <div className="flex justify-between text-yellow-200">
                          <span>Model:</span>
                          <span className="font-semibold">{usageEstimate.model}</span>
                        </div>
                        <div className="pt-2 border-t border-yellow-500/20">
                          <div className="text-yellow-300 font-semibold mb-1">Estimated Tokens:</div>
                          <div className="pl-2 space-y-1">
                            <div className="flex justify-between text-yellow-200">
                              <span>Prompt:</span>
                              <span>{usageEstimate.estimates.promptTokens.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-yellow-200">
                              <span>Output:</span>
                              <span>{usageEstimate.estimates.outputTokens.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-yellow-300 font-semibold pt-1 border-t border-yellow-500/20">
                              <span>Total:</span>
                              <span>{usageEstimate.estimates.totalTokens.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-yellow-500/20">
                          <div className="text-yellow-300 font-semibold mb-1">Current Usage:</div>
                          <div className="pl-2 space-y-1">
                            <div className="flex justify-between text-yellow-200">
                              <span>Requests:</span>
                              <span>{usageEstimate.currentUsage.requests.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-yellow-200">
                              <span>Total Tokens:</span>
                              <span>{usageEstimate.currentUsage.tokens.totalTokens.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-yellow-500/20">
                          <div className="flex justify-between text-yellow-200">
                            <span>Over Usage:</span>
                            <span className="text-yellow-400">N/A (limits not configured)</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-yellow-400/80">
                        Enter a description to see usage estimates
                      </div>
                    )}
                  </div>
                )}

                {/* Keyword Count (only when LLM is off) */}
                {!useLLM && (
                  <div className="space-y-3 p-4 bg-slate-900/50 rounded-xl border border-blue-500/20">
                    <label
                      htmlFor="keywordCount"
                      className="block text-sm font-bold text-blue-300"
                    >
                      Number of Keywords
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        id="keywordCount"
                        min="5"
                        max="30"
                        value={keywordCount}
                        onChange={(e) =>
                          setKeywordCount(parseInt(e.target.value))
                        }
                        className="flex-1 h-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${((keywordCount - 5) / 25) * 100}%, rgb(51, 65, 85) ${((keywordCount - 5) / 25) * 100}%, rgb(51, 65, 85) 100%)`,
                        }}
                      />
                      <span className="text-2xl font-bold w-14 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {keywordCount}
                      </span>
                    </div>
                    <p className="text-xs text-blue-400/80">
                      Select how many keywords to return
                    </p>
                  </div>
                )}

                {/* Info Section */}
                <div className="pt-4 border-t border-purple-500/30">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <svg
                        className="w-5 h-5 mt-0.5 text-green-400 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="text-green-300">
                        <strong className="text-green-400 font-bold">LLM Mode:</strong>{' '}
                        Uses semantic embeddings + AI selection for better accuracy
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <svg
                        className="w-5 h-5 mt-0.5 text-blue-400 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="text-blue-300">
                        <strong className="text-blue-400 font-bold">Direct Mode:</strong>{' '}
                        Faster results using only semantic similarity
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}
