export type GoogleRuntimeConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  spreadsheetId: string;
  atomicMutationUrl?: string;
  atomicMutationSecret?: string;
};

type Environment = Record<string, string | undefined>;

function required(environment: Environment, name: string) {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error("GOOGLE_CONFIG_MISSING");
  }
  return value;
}

export function getGoogleRuntimeConfig(
  environment: Environment = process.env,
): GoogleRuntimeConfig {
  return {
    clientId: required(environment, "GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: required(environment, "GOOGLE_OAUTH_CLIENT_SECRET"),
    redirectUri: required(environment, "GOOGLE_OAUTH_REDIRECT_URI"),
    sessionSecret: required(environment, "SESSION_SECRET"),
    serviceAccountEmail: required(environment, "GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    serviceAccountPrivateKey: required(environment, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
      /\\n/g,
      "\n",
    ),
    spreadsheetId: required(environment, "GOOGLE_SHEET_ID"),
    atomicMutationUrl: environment.GOOGLE_ATOMIC_MUTATION_URL?.trim() || undefined,
    atomicMutationSecret: environment.GOOGLE_ATOMIC_MUTATION_SECRET?.trim() || undefined,
  };
}
