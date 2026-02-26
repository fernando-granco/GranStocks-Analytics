import { decryptText } from '../utils/crypto';
import { prisma } from './cache';
import { URL } from 'url';

import * as dns from 'dns/promises';

export async function validateBaseUrl(urlStr: string | null | undefined, isCompat: boolean = false): Promise<string | undefined> {
    if (!urlStr) return undefined;
    let url: URL;
    try {
        url = new URL(urlStr);
    } catch {
        throw new Error('Invalid Base URL format');
    }

    if (url.protocol !== 'https:') {
        throw new Error('Base URL must use HTTPS');
    }

    const hostname = url.hostname.toLowerCase();

    // Explicit Allowlist for known public providers
    const allowList = [
        'api.openai.com',
        'api.anthropic.com',
        'generativelanguage.googleapis.com',
        'api.groq.com',
        'api.together.xyz',
        'api.deepseek.com',
        'api.x.ai'
    ];

    if (!isCompat && !allowList.includes(hostname)) {
        throw new Error(`Hostname ${hostname} is not allowed. Use OPENAI_COMPAT for custom domains.`);
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        throw new Error('Base URL cannot resolve to localhost');
    }

    try {
        const lookup = await dns.lookup(hostname);
        const ip = lookup.address.toLowerCase();

        // Check for loopback, link-local, private, and metadata IPs
        if (ip === '127.0.0.1' || ip === '::1' ||
            ip.startsWith('10.') ||
            ip.startsWith('192.168.') ||
            ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) || // Private IPv4
            ip.startsWith('169.254.') || // IPv4 Link-local / Cloud metadata (e.g. 169.254.169.254)
            ip.startsWith('fe80:') || // IPv6 Link-local
            ip.startsWith('fc') || ip.startsWith('fd') // IPv6 Private / ULA (includes fd00:ec2::254)
        ) {
            throw new Error('Base URL resolves to a forbidden private or link-local IP address');
        }
    } catch (err: any) {
        if (err.message.includes('forbidden private')) throw err;
        throw new Error(`Could not resolve hostname ${hostname}`);
    }

    return urlStr.replace(/\/$/, "");
}

export interface LLMProvider {
    generateNarrative(prompt: string, language?: string): Promise<string>;
}

export class OpenAIProvider implements LLMProvider {
    constructor(private apiKey: string, private model: string = "gpt-4o-mini", private baseUrl?: string) { }

    async generateNarrative(prompt: string, language: string = 'en'): Promise<string> {
        let systemPrompt = 'You are a financial analyst generating a short daily narrative based ONLY on provided deterministic indicators.';
        if (language === 'pt-BR') {
            systemPrompt += ' IMPORTANT: Your final output MUST be evaluated and written in fluent Brazilian Portuguese (pt-BR).';
        }

        const url = this.baseUrl ? `${this.baseUrl}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
        const res = await fetch(url, {
            method: 'POST',
            redirect: 'error',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
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
        return data.choices[0].message.content;
    }
}

export class GeminiProvider implements LLMProvider {
    constructor(private apiKey: string, private model: string = "gemini-1.5-flash") { }

    async generateNarrative(prompt: string, language: string = 'en'): Promise<string> {
        let systemPrompt = 'You are a financial analyst generating a short daily narrative based ONLY on provided deterministic indicators.';
        if (language === 'pt-BR') {
            systemPrompt += ' IMPORTANT: Your final output MUST be evaluated and written in fluent Brazilian Portuguese (pt-BR).';
        }

        // Simple fetch to Gemini REST API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            redirect: 'error',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }]
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
        return text;
    }
}

export class AnthropicProvider implements LLMProvider {
    constructor(private apiKey: string, private model: string = "claude-3-haiku-20240307") { }

    async generateNarrative(prompt: string, language: string = 'en'): Promise<string> {
        let systemPrompt = 'You are a financial analyst generating a short daily narrative based ONLY on provided deterministic indicators.';
        if (language === 'pt-BR') {
            systemPrompt += ' IMPORTANT: Your final output MUST be evaluated and written in fluent Brazilian Portuguese (pt-BR).';
        }

        const url = 'https://api.anthropic.com/v1/messages';
        const res = await fetch(url, {
            method: 'POST',
            redirect: 'error',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 300,
                system: systemPrompt,
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
        return data.content[0].text;
    }
}

export class LLMService {
    static async getProviderInstance(configId: string, userId: string): Promise<LLMProvider> {
        const config = await prisma.userLLMConfig.findFirst({
            where: { id: configId, userId }
        });

        if (!config) {
            throw new Error("LLM Config not found or unauthorized");
        }

        const apiKey = decryptText(config.encryptedApiKey);
        let baseUrl: string | undefined;

        switch (config.provider) {
            case 'OPENAI':
                return new OpenAIProvider(apiKey, config.model);
            case 'DEEPSEEK':
                baseUrl = await validateBaseUrl(config.baseUrl);
                return new OpenAIProvider(apiKey, config.model, baseUrl ?? 'https://api.deepseek.com/v1');
            case 'OPENAI_COMPAT':
                baseUrl = await validateBaseUrl(config.baseUrl, true);
                return new OpenAIProvider(apiKey, config.model, baseUrl);
            case 'GROQ':
                baseUrl = await validateBaseUrl(config.baseUrl);
                return new OpenAIProvider(apiKey, config.model, baseUrl ?? 'https://api.groq.com/openai/v1');
            case 'TOGETHER':
                baseUrl = await validateBaseUrl(config.baseUrl);
                return new OpenAIProvider(apiKey, config.model, baseUrl ?? 'https://api.together.xyz/v1');
            case 'XAI':
                baseUrl = await validateBaseUrl(config.baseUrl);
                return new OpenAIProvider(apiKey, config.model, baseUrl ?? 'https://api.x.ai/v1');
            case 'ANTHROPIC':
                return new AnthropicProvider(apiKey, config.model);
            case 'GEMINI':
                return new GeminiProvider(apiKey, config.model);
            default:
                throw new Error("Unsupported provider");
        }
    }

    static async generateNarrative(configId: string, userId: string, symbol: string | null, date: string, promptDataJson: string, role: string = 'CONSENSUS', language: string = 'en'): Promise<string> {
        const provider = await LLMService.getProviderInstance(configId, userId);

        const config = await prisma.userLLMConfig.findFirst({ where: { id: configId, userId } });
        if (!config) throw new Error("LLM Config not found or unauthorized");
        const promptTemplate = await prisma.promptTemplate.findFirst({
            where: { userId: config.userId, role, enabled: true, scope: 'GLOBAL' }
        });

        let prompt = `Please review this deterministic market data for ${symbol ?? 'your daily portfolio summary'} on ${date}:\n\n${promptDataJson}\n\nProvide a short, 2-3 sentence financial analysis.`;
        let isJsonMode = false;

        if (promptTemplate) {
            let safeData = promptDataJson;
            if (safeData.length > 25000) {
                safeData = safeData.substring(0, 25000) + "\n... [TRUNCATED FOR SAFE SIZE LIMIT]";
            }
            prompt = promptTemplate.templateText
                .replace(/{{EVIDENCE_PACK}}/g, safeData)
                .replace(/{{EVIDENCE_PACK_JSON}}/g, safeData)
                .replace(/{{ASSET_SYMBOL}}/g, symbol ?? 'Portfolio')
                .replace(/{{DATE}}/g, date);

            isJsonMode = promptTemplate.outputMode === 'ACTION_LABELS';

            if (promptTemplate.outputMode === 'JSON') {
                prompt += '\n\nPlease return your response ONLY as valid JSON.';
            } else if (promptTemplate.outputMode === 'MARKDOWN') {
                prompt += '\n\nPlease format your numerical analysis and insights using well-structured Markdown format (headers, bolding, lists).';
            }
        }

        if (isJsonMode) {
            prompt += '\n\nYou MUST return ONLY valid JSON in this exact structure: { "action": "BUY" | "WAIT" | "SELL", "narrative": "your strictly educational analysis" }';
        }

        let narrative = await provider.generateNarrative(prompt, language);

        // Strip out any trailing simulation text for JSON mode
        const simulationText = "\n\n(AI-generated commentary - simulation only)";
        if (isJsonMode && narrative.endsWith(simulationText)) {
            narrative = narrative.substring(0, narrative.length - simulationText.length);
        }

        if (isJsonMode) {
            let cleanNarrative = narrative.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                JSON.parse(cleanNarrative);
                return cleanNarrative;
            } catch (e) {
                // Repair
                const repairPrompt = `The following JSON is invalid. Fix it to be exactly { "action": "BUY" | "WAIT" | "SELL", "narrative": "..." } with valid JSON syntax. Return ONLY the JSON.\n\n${cleanNarrative}`;
                let repaired = await provider.generateNarrative(repairPrompt, language);
                if (repaired.endsWith(simulationText)) repaired = repaired.substring(0, repaired.length - simulationText.length);
                repaired = repaired.replace(/```json/g, '').replace(/```/g, '').trim();

                try {
                    JSON.parse(repaired);
                    return repaired;
                } catch (e2) {
                    return JSON.stringify({ action: "WAIT", narrative: "Failed to parse LLM Action Label response. Raw output: " + cleanNarrative });
                }
            }
        } else if (promptTemplate && promptTemplate.outputMode === 'JSON') {
            let cleanNarrative = narrative.replace(/```json/g, '').replace(/```/g, '').trim();
            return cleanNarrative;
        }

        return narrative;
    }
}
