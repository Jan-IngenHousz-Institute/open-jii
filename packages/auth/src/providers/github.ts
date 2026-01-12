interface GitHubProfile {
  id: number;
  email: string;
  name?: string;
  login: string;
  avatar_url: string;
}

export function githubProvider(config: { clientId: string; clientSecret: string }) {
  return {
    id: "github",
    name: "GitHub",
    type: "oauth2" as const,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scope: ["read:user", "user:email"],
    mapProfileToUser: (profile: GitHubProfile) => {
      return {
        id: String(profile.id),
        email: profile.email,
        name: profile.name ?? profile.login,
        image: profile.avatar_url,
        emailVerified: true,
        registered: false,
      };
    },
  };
}
