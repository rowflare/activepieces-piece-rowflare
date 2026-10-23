import { HttpMethod } from '@activepieces/pieces-common';
import { createAction } from '@activepieces/pieces-framework';
import { rowflareAuth } from '../auth';
import { rowflareClient, RowflareRecord } from '../common/client';
import { rowflareProps } from '../common/props';

export const getRecordAction = createAction({
  auth: rowflareAuth,
  name: 'get_record',
  classification: 'READ',
  displayName: 'Get Record',
  description: 'Gets one record by its ID.',
  audience: 'both',
  aiMetadata: {
    description:
      'Reads one Rowflare record by its integer ID and returns its fields. Use Find Records to look records up by value instead. Safe to retry.',
    idempotent: true,
  },
  props: {
    base: rowflareProps.base,
    table: rowflareProps.table,
    record_id: rowflareProps.recordId,
  },
  async run(context) {
    const { base, table, record_id } = context.propsValue;
    return rowflareClient.request<RowflareRecord>({
      auth: context.auth,
      method: HttpMethod.GET,
      path: rowflareClient.recordsPath({ baseId: base, tableId: table, recordId: rowflareClient.parseRecordId(record_id) }),
    });
  },
});
