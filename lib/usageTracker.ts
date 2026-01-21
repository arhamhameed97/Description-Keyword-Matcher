type Provider = 'openai' | 'gemini' | 'openrouter';

type TokenUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type ModelUsage = {
  requests: number;
  tokens: TokenUsage;
};

type ProviderUsage = {
  requests: number;
  models: Record<string, ModelUsage>;
  tokens: TokenUsage;
};

type UserUsage = {
  requests: number;
  tokens: TokenUsage;
  models: Record<string, ModelUsage>;
};

type UsageSnapshot = {
  since: string;
  requests: number;
  tokens: TokenUsage;
  providers: Record<Provider, ProviderUsage>;
  users: Record<string, UserUsage>;
  lastRequest?: {
    at: string;
    provider: Provider;
    model: string;
    user: string;
    tokens: TokenUsage;
  };
};

const createEmptyTokens = (): TokenUsage => ({
  promptTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

const usageState: UsageSnapshot = {
  since: new Date().toISOString(),
  requests: 0,
  tokens: createEmptyTokens(),
  providers: {
    openai: {
      requests: 0,
      models: {},
      tokens: createEmptyTokens(),
    },
    gemini: {
      requests: 0,
      models: {},
      tokens: createEmptyTokens(),
    },
    openrouter: {
      requests: 0,
      models: {},
      tokens: createEmptyTokens(),
    },
  },
  users: {},
};

const applyTokens = (target: TokenUsage, delta: Partial<TokenUsage>) => {
  target.promptTokens += delta.promptTokens ?? 0;
  target.outputTokens += delta.outputTokens ?? 0;
  target.totalTokens +=
    delta.totalTokens ??
    ((delta.promptTokens ?? 0) + (delta.outputTokens ?? 0));
};

const getOrCreateModelUsage = (
  models: Record<string, ModelUsage>,
  model: string
): ModelUsage => {
  if (!models[model]) {
    models[model] = {
      requests: 0,
      tokens: createEmptyTokens(),
    };
  }
  return models[model];
};

const getOrCreateUserUsage = (userId: string): UserUsage => {
  if (!usageState.users[userId]) {
    usageState.users[userId] = {
      requests: 0,
      tokens: createEmptyTokens(),
      models: {},
    };
  }
  return usageState.users[userId];
};

export const recordUsage = ({
  provider,
  model,
  userId,
  tokens,
}: {
  provider: Provider;
  model: string;
  userId: string;
  tokens?: Partial<TokenUsage>;
}) => {
  usageState.requests += 1;
  const providerUsage = usageState.providers[provider];
  providerUsage.requests += 1;

  const modelUsage = getOrCreateModelUsage(providerUsage.models, model);
  modelUsage.requests += 1;

  const userUsage = getOrCreateUserUsage(userId);
  userUsage.requests += 1;
  const userModelUsage = getOrCreateModelUsage(userUsage.models, model);
  userModelUsage.requests += 1;

  if (tokens) {
    applyTokens(usageState.tokens, tokens);
    applyTokens(providerUsage.tokens, tokens);
    applyTokens(modelUsage.tokens, tokens);
    applyTokens(userUsage.tokens, tokens);
    applyTokens(userModelUsage.tokens, tokens);
  }

  usageState.lastRequest = {
    at: new Date().toISOString(),
    provider,
    model,
    user: userId,
    tokens: {
      promptTokens: tokens?.promptTokens ?? 0,
      outputTokens: tokens?.outputTokens ?? 0,
      totalTokens:
        tokens?.totalTokens ??
        ((tokens?.promptTokens ?? 0) + (tokens?.outputTokens ?? 0)),
    },
  };
};

export const getUsageSnapshot = (): UsageSnapshot =>
  JSON.parse(JSON.stringify(usageState));
