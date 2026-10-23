import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { rowflareAuth } from '../auth';
import { rowflareClient, RowflareRecord } from '../common/client';
import { rowflareProps } from '../common/props';

export const createRecordAction = createAction({
  auth: rowflareAuth,
  name: 'create_record',
  classification: 'WRITE',
  displayName: 'Create Record',
  description: 'Adds a new record to a table.',
  audience: 'both',
  aiMetadata: {
    description:
      'Creates one record in a Rowflare table from field values keyed by field. Use to append a row; use Update Record to change an existing one. Each call creates a new record, so retries duplicate.',
    idempotent: false,
  },
  props: {
    base: rowflareProps.base,
    table: rowflareProps.table,
    fields: rowflareProps.fields({ required: true }),
    typecast: Property.Checkbox({
      displayName: 'Convert Values',
      description:
        'Convert text to the field type: numbers, dates such as 10/13/2026, new select options, and linked records by primary field value. Turn off to reject values that do not match exactly.',
      required: false,
      defaultValue: true,
    }),
  },
  async run(context) {
    const { base, table, fields, typecast } = context.propsValue;
    return rowflareClient.request<RowflareRecord>({
      auth: context.auth,
      method: HttpMethod.POST,
      path: rowflareClient.recordsPath({ baseId: base, tableId: table }),
      body: { fields: rowflareProps.cleanFields({ values: fields ?? {} }), typecast: typecast !== false },
    });
  },
});
