import { decryptText } from '../utils/crypto';
import { prisma } from './cache';

export interface LLMProvider {
    generateNarrative(prompt: string): Promise<string>;
}

export class OpenAIProvider implements LLMProvider {
    constructor(private apiKey: string, private model: string = "gpt-4o-mini", private baseUrl?: string) { }

    async generateNarrative(prompt: string): Promise<string> {
        const url = this.baseUrl ? `${this.baseUrl}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: 'You are a financial analyst generating a short daily narrative based ONLY on provided deterministic indicators.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300
            })
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => res.statusText);
            throw new Error(`OpenAI API Error (${res.status}): ${errBody}`);
        }
        const data = await res.json();
        return data.choices[0].message.content + "\n\n(AI-generated commentary - simulation only)";
    }
}

export class GeminiProvider implements LLMProvider {
    constructor(private apiKey: string, private model: string = "gemini-1.5-flash") { }

    async generateNarrative(prompt: string): Promise<string> {
        // Simple fetch to Gemini REST API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: 'You are a financial analyst generating a short daily narrative based ONLY on provided deterministic indicators.' }]
                },
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 300 }
            })
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => res.statusText);
            throw new Error(`Gemini API Error (${res.status}): ${errBody}`);
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
        return text + "\n\n(AI-generated commentary - simulation only)";
    }
}

export class AnthropicProvider implements LLMProvider {
    constructor(private apiKey: string, private model: string = "claude-3-haiku-20240307") { }

    async generateNarrative(prompt: string): Promise<string> {
        const url = 'https://api.anthropic.com/v1/messages';
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 300,
                system: 'You are a financial analyst generating a short daily narrative based ONLY on provided deterministic indicators.',
                messages: [
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => res.statusText);
            throw new Error(`Anthropic API Error (${res.status}): ${errBody}`);
        }
        const data = await res.json();
        return data.content[0].text + "\n\n(AI-generated commentary - simulation only)";
    }
}

export class LLMService {
    static async getProviderInstance(configId: string): Promise<LLMProvider> {
        const config = await prisma.userLLMConfig.findUniqueOrThrow({
            where: { id: configId }
        });

        // Dynamic quotas: max 10 requests per day per provider config
        const today = new Date().toISOString().split('T')[0];
        const usageCount = await prisma.aiNarrative.count({
            where: { llmConfigId: configId, dateHour: today }
        });

        if (usageCount >= 10) {
            throw new Error(`Daily quota (10 requests) reached for provider config ${config.name}`);
        }

        const apiKey = decryptText(config.encryptedApiKey);

        switch (config.provider) {
            case 'OPENAI':
                return new OpenAIProvider(apiKey, config.model);
            case 'DEEPSEEK':
                return new OpenAIProvider(apiKey, config.model, config.baseUrl ?? 'https://api.deepseek.com/v1');
            case 'OPENAI_COMPAT':
                return new OpenAIProvider(apiKey, config.model, config.baseUrl ?? undefined);
            case 'GROQ':
                return new OpenAIProvider(apiKey, config.model, config.baseUrl ?? 'https://api.groq.com/openai/v1');
            case 'TOGETHER':
                return new OpenAIProvider(apiKey, config.model, config.baseUrl ?? 'https://api.together.xyz/v1');
            case 'OLLAMA':
                return new OpenAIProvider(apiKey || 'ollama', config.model, config.baseUrl ?? 'http://localhost:11434/v1');
            case 'ANTHROPIC':
                return new AnthropicProvider(apiKey, config.model);
            case 'GEMINI':
                return new GeminiProvider(apiKey, config.model);
            default:
                throw new Error("Unsupported provider");
        }
    }

    static async generateNarrative(configId: string, symbol: string | null, date: string, promptDataJson: string): Promise<string> {
        const provider = await getProviderInstance(configId);
        const prompt = `Please review this deterministic market data for ${symbol ?? 'your daily portfolio summary'} on ${date}:\n\n${promptDataJson}\n\nProvide a short, 2-3 sentence financial analysis.`;

        const narrative = await provider.generateNarrative(prompt);
        return narrative;
    }
}

// Ensure function is hoisted globally available internally
const getProviderInstance = LLMService.getProviderInstance;
