import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { PieceAuth, Property } from '@activepieces/pieces-framework';

export const rowflareAuth = PieceAuth.CustomAuth({
  displayName: 'Connection',
  required: true,
  description: `
To connect Rowflare:

1. Sign in to Rowflare (app.rowflare.com or your own instance).
2. Open **Settings**, then **API tokens**, and create a token. It starts with \`rf_\` and is shown once.
3. Paste the token below. Keep the default Instance URL for the hosted service, or enter the address of your self-hosted instance.

The token acts as you: a viewer's token can read records but not change them.
`,
  props: {
    base_url: Property.ShortText({
      displayName: 'Instance URL',
      description:
        'Address of your Rowflare instance, for example https://rowflare.example.com. Keep https://app.rowflare.com for the hosted service.',
      required: true,
      defaultValue: 'https://app.rowflare.com',
    }),
    api_token: PieceAuth.SecretText({
      displayName: 'API Token',
      description: 'Personal access token from Settings, API tokens, for example rf_AbC123...',
      required: true,
    }),
  },
  validate: async ({ auth }) => {
    try {
      await httpClient.sendRequest({
        method: HttpMethod.GET,
        url: `${trimBaseUrl(auth.base_url)}/api/v1/bases`,
        headers: { Authorization: `Bearer ${auth.api_token}` },
      });
      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Could not list bases with this token. Check the Instance URL and the API token.',
      };
    }
  },
});

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}
