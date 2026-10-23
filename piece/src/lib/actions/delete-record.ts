import { HttpMethod } from '@activepieces/pieces-common';
import { createAction } from '@activepieces/pieces-framework';
import { rowflareAuth } from '../auth';
import { rowflareClient } from '../common/client';
import { rowflareProps } from '../common/props';

export const deleteRecordAction = createAction({
  auth: rowflareAuth,
  name: 'delete_record',
  classification: 'DESTRUCTIVE',
  displayName: 'Delete Record',
  description: 'Deletes a record by its ID.',
  audience: 'both',
  aiMetadata: {
    description:
      'Permanently deletes one Rowflare record by its integer ID. A retry after success fails because the record no longer exists.',
    idempotent: false,
  },
  props: {
    base: rowflareProps.base,
    table: rowflareProps.table,
    record_id: rowflareProps.recordId,
  },
  async run(context) {
    const { base, table, record_id } = context.propsValue;
    return rowflareClient.request<{ id: number; deleted: boolean }>({
      auth: context.auth,
      method: HttpMethod.DELETE,
      path: rowflareClient.recordsPath({ baseId: base, tableId: table, recordId: rowflareClient.parseRecordId(record_id) }),
    });
  },
});
