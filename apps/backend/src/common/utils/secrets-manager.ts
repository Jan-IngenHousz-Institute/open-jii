import {
    GetSecretValueCommand,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

interface CachedSecret {
    value: Record<string, unknown>;
    fetchedAt: number;
}

/**
 * Utility class for fetching and caching secrets from AWS Secrets Manager
 * Implements caching to reduce API calls and improve performance
 */
export class SecretsManager {
    private static instance: SecretsManager;
    private client: SecretsManagerClient;
    private cache: Map<string, CachedSecret> = new Map();
    private readonly cacheTTL: number;

    private constructor(region?: string, cacheTTL = 300000) {
        // 5 minutes default
        this.client = new SecretsManagerClient({
            region: region || process.env.AWS_REGION || "us-east-1",
        });
        this.cacheTTL = cacheTTL;
    }

    /**
     * Get singleton instance of SecretsManager
     */
    public static getInstance(region?: string, cacheTTL?: number): SecretsManager {
        if (!SecretsManager.instance) {
            SecretsManager.instance = new SecretsManager(region, cacheTTL);
        }
        return SecretsManager.instance;
    }

    /**
     * Fetch a secret from AWS Secrets Manager with caching
     * @param secretArn - ARN of the secret to fetch
     * @param forceRefresh - Force refresh from AWS, bypassing cache
     * @returns Parsed secret value as JSON object
     */
    async getSecret(
        secretArn: string,
        forceRefresh = false,
    ): Promise<Record<string, unknown>> {
        const now = Date.now();
        const cached = this.cache.get(secretArn);

        // Return cached value if it's still valid and not forced to refresh
        if (cached && !forceRefresh && now - cached.fetchedAt < this.cacheTTL) {
            return cached.value;
        }

        try {
            const command = new GetSecretValueCommand({
                SecretId: secretArn,
            });

            const response = await this.client.send(command);

            if (!response.SecretString) {
                throw new Error(`Secret ${secretArn} does not contain a string value`);
            }

            const secretValue = JSON.parse(response.SecretString) as Record<string, unknown>;

            // Cache the secret
            this.cache.set(secretArn, {
                value: secretValue,
                fetchedAt: now,
            });

            return secretValue;
        } catch (error) {
            // If fetching fails but we have a cached value, return it
            if (cached) {
                console.warn(
                    `Failed to refresh secret ${secretArn}, using cached value:`,
                    error,
                );
                return cached.value;
            }

            console.error(`Failed to fetch secret ${secretArn}:`, error);
            throw error;
        }
    }

    /**
     * Clear cache for a specific secret or all secrets
     * @param secretArn - Optional ARN to clear, if not provided clears all
     */
    clearCache(secretArn?: string): void {
        if (secretArn) {
            this.cache.delete(secretArn);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Get database credentials from a secret
     * Expects secret to contain 'username' and 'password' fields
     */
    async getDatabaseCredentials(
        secretArn: string,
    ): Promise<{ username: string; password: string }> {
        const secret = await this.getSecret(secretArn);

        if (!secret.username || !secret.password) {
            throw new Error(
                `Secret ${secretArn} does not contain required database credentials (username, password)`,
            );
        }

        return {
            username: secret.username as string,
            password: secret.password as string,
        };
    }
}

/**
 * Helper function to get the singleton instance
 */
export const getSecretsManager = (region?: string, cacheTTL?: number) =>
    SecretsManager.getInstance(region, cacheTTL);
