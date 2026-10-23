import { createAction, Property } from '@activepieces/pieces-framework';
import { rowflareAuth } from '../auth';
import { rowflareClient } from '../common/client';
import { rowflareProps } from '../common/props';

export const findRecordsAction = createAction({
  auth: rowflareAuth,
  name: 'find_records',
  classification: 'SEARCH',
  displayName: 'Find Records',
  description: 'Lists records, optionally filtered by a formula or a view and sorted by a field.',
  audience: 'both',
  aiMetadata: {
    description:
      'Returns zero or more Rowflare records from a table, filtered by an Airtable-style formula such as {Status} = "Done" and/or a view, optionally sorted and capped. Use Get Record when the record ID is known. Safe to retry.',
    idempotent: true,
  },
  props: {
    base: rowflareProps.base,
    table: rowflareProps.table,
    formula: Property.ShortText({
      displayName: 'Filter Formula',
      description:
        'Only return records for which this formula is true. Field names go in braces, for example AND({Status} = "Done", {Estimate} > 5). Leave empty to return all records.',
      required: false,
    }),
    view: rowflareProps.view,
    sort_field: rowflareProps.sortField,
    sort_direction: Property.StaticDropdown({
      displayName: 'Sort Direction',
      required: false,
      defaultValue: 'asc',
      options: {
        disabled: false,
        options: [
          { label: 'Ascending', value: 'asc' },
          { label: 'Descending', value: 'desc' },
        ],
      },
    }),
    max_records: Property.Number({
      displayName: 'Max Records',
      description: 'Stop after this many records. Leave empty to return every matching record.',
      required: false,
      defaultValue: 100,
    }),
  },
  async run(context) {
    const { base, table, formula, view, sort_field, sort_direction, max_records } = context.propsValue;
    const maxRecords = typeof max_records === 'number' && max_records > 0 ? Math.floor(max_records) : undefined;
    return rowflareClient.listRecords({
      auth: context.auth,
      baseId: base,
      tableId: table,
      filterByFormula: formula || undefined,
      view: view || undefined,
      sortField: sort_field || undefined,
      sortDirection: sort_direction ?? 'asc',
      maxRecords,
    });
  },
});
