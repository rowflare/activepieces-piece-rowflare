import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { createPiece, PieceCategory } from '@activepieces/pieces-framework';
import { createRecordAction } from './lib/actions/create-record';
import { deleteRecordAction } from './lib/actions/delete-record';
import { findRecordsAction } from './lib/actions/find-records';
import { getRecordAction } from './lib/actions/get-record';
import { updateRecordAction } from './lib/actions/update-record';
import { rowflareAuth } from './lib/auth';
import { newRecordTrigger } from './lib/triggers/new-record';

export const rowflare = createPiece({
  displayName: 'Rowflare',
  description: 'Open-source Airtable alternative: bases, tables and records you can host yourself.',
  auth: rowflareAuth,
  minimumSupportedRelease: '0.36.1',
  logoUrl: 'https://rowflare.com/favicon.svg',
  categories: [PieceCategory.PRODUCTIVITY],
  authors: ['rowflare'],
  actions: [
    createRecordAction,
    updateRecordAction,
    getRecordAction,
    findRecordsAction,
    deleteRecordAction,
    createCustomApiCallAction({
      auth: rowflareAuth,
      baseUrl: (auth) => (auth ? `${auth.props.base_url.trim().replace(/\/+$/, '')}/api/v1` : ''),
      authMapping: async (auth) => ({
        Authorization: `Bearer ${auth.props.api_token}`,
      }),
    }),
  ],
  triggers: [newRecordTrigger],
});
