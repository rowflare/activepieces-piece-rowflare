import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { rowflareAuth } from '../auth';
import { rowflareClient, RowflareRecord } from '../common/client';
import { rowflareProps } from '../common/props';

export const updateRecordAction = createAction({
  auth: rowflareAuth,
  name: 'update_record',
  classification: 'WRITE',
  displayName: 'Update Record',
  description: 'Changes the fields you fill in on an existing record.',
  audience: 'both',
  aiMetadata: {
    description:
      'Sets the given fields on one existing Rowflare record identified by its integer ID; fields left empty keep their values. Use Create Record for new rows. Safe to retry with the same values.',
    idempotent: true,
  },
  props: {
    base: rowflareProps.base,
    table: rowflareProps.table,
    record_id: rowflareProps.recordId,
    fields: rowflareProps.fields({ required: false }),
    typecast: Property.Checkbox({
      displayName: 'Convert Values',
      description:
        'Convert text to the field type: numbers, dates such as 10/13/2026, new select options, and linked records by primary field value.',
      required: false,
      defaultValue: true,
    }),
  },
  async run(context) {
    const { base, table, record_id, fields, typecast } = context.propsValue;
    return rowflareClient.request<RowflareRecord>({
      auth: context.auth,
      method: HttpMethod.PATCH,
      path: rowflareClient.recordsPath({ baseId: base, tableId: table, recordId: rowflareClient.parseRecordId(record_id) }),
      body: { fields: rowflareProps.cleanFields({ values: fields ?? {} }), typecast: typecast !== false },
    });
  },
});
