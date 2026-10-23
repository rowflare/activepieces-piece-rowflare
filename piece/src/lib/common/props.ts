import { DynamicPropsValue, Property } from '@activepieces/pieces-framework';
import { rowflareAuth } from '../auth';
import { rowflareClient, RowflareField } from './client';

const base = Property.Dropdown({
  auth: rowflareAuth,
  displayName: 'Base',
  description: 'The Rowflare base to work in.',
  required: true,
  refreshers: [],
  options: async ({ auth }) => {
    if (!auth) {
      return { disabled: true, options: [], placeholder: 'Please connect your Rowflare account first' };
    }
    const bases = await rowflareClient.listBases({ auth });
    return {
      disabled: false,
      options: bases.map((item) => ({ label: item.name, value: item.id })),
      placeholder: bases.length === 0 ? 'No bases found for this token' : undefined,
    };
  },
});

const table = Property.Dropdown({
  auth: rowflareAuth,
  displayName: 'Table',
  description: 'The table in the selected base.',
  required: true,
  refreshers: ['base'],
  options: async ({ auth, base }) => {
    if (!auth || typeof base !== 'string' || base === '') {
      return { disabled: true, options: [], placeholder: 'Please select a base first' };
    }
    const tables = await rowflareClient.listTables({ auth, baseId: base });
    return {
      disabled: false,
      options: tables.map((item) => ({ label: item.name, value: item.id })),
    };
  },
});

const view = Property.Dropdown({
  auth: rowflareAuth,
  displayName: 'View',
  description: 'Only use records shown in this view, with its filters and sorts applied. Leave empty for the whole table.',
  required: false,
  refreshers: ['base', 'table'],
  options: async ({ auth, base, table }) => {
    if (!auth || typeof base !== 'string' || typeof table !== 'string' || base === '' || table === '') {
      return { disabled: true, options: [], placeholder: 'Please select a base and a table first' };
    }
    const schema = await rowflareClient.getTable({ auth, baseId: base, tableId: table });
    return {
      disabled: false,
      options: (schema?.views ?? []).map((item) => ({ label: item.name, value: item.id })),
    };
  },
});

const sortField = Property.Dropdown({
  auth: rowflareAuth,
  displayName: 'Sort By',
  description: 'Field to sort the records by. Leave empty to keep the table order.',
  required: false,
  refreshers: ['base', 'table'],
  options: async ({ auth, base, table }) => {
    if (!auth || typeof base !== 'string' || typeof table !== 'string' || base === '' || table === '') {
      return { disabled: true, options: [], placeholder: 'Please select a base and a table first' };
    }
    const schema = await rowflareClient.getTable({ auth, baseId: base, tableId: table });
    return {
      disabled: false,
      options: (schema?.fields ?? []).map((item) => ({ label: item.name, value: item.id })),
    };
  },
});

const recordId = Property.ShortText({
  displayName: 'Record ID',
  description: 'ID of the record, a whole number such as 17. Use the "id" of a record returned by another Rowflare step.',
  required: true,
});

function fields({ required }: { required: boolean }) {
  return Property.DynamicProperties({
    auth: rowflareAuth,
    displayName: 'Fields',
    description: required
      ? 'Values for the new record. Computed fields (formula, lookup, rollup, created time, autonumber) and attachments are not shown because the API cannot write them.'
      : 'Only fields you fill in are changed; the others keep their values.',
    required: true,
    refreshers: ['base', 'table'],
    props: async ({ auth, base, table }): Promise<DynamicPropsValue> => {
      if (!auth || typeof base !== 'string' || typeof table !== 'string' || base === '' || table === '') {
        return {};
      }
      const schema = await rowflareClient.getTable({ auth, baseId: base, tableId: table });
      if (!schema) {
        return {};
      }
      return Object.fromEntries(
        schema.fields
          .filter((field) => WRITABLE_TYPES.includes(field.type))
          .map((field) => [field.id, fieldProperty({ field })]),
      );
    },
  });
}

function fieldProperty({ field }: { field: RowflareField }) {
  const description = field.description || undefined;
  const choices = (field.options?.choices ?? []).map((choice) => ({ label: choice.name, value: choice.name }));
  switch (field.type) {
    case 'longText':
      return Property.LongText({ displayName: field.name, description, required: false });
    case 'number':
      return Property.Number({ displayName: field.name, description, required: false });
    case 'checkbox':
      return Property.Checkbox({ displayName: field.name, description, required: false });
    case 'date':
      return Property.DateTime({
        displayName: field.name,
        description: description ?? (field.options?.includeTime ? 'Date and time, for example 2026-10-13T09:30:00Z.' : 'Date, for example 2026-10-13.'),
        required: false,
      });
    case 'singleSelect':
      return Property.StaticDropdown({
        displayName: field.name,
        description,
        required: false,
        options: { disabled: false, options: choices },
      });
    case 'multiSelect':
      return Property.StaticMultiSelectDropdown({
        displayName: field.name,
        description,
        required: false,
        options: { disabled: false, options: choices },
      });
    case 'link':
      return Property.Array({
        displayName: field.name,
        description: description ?? 'Linked records, by record ID or by the value of their primary field. Unknown values create new linked records.',
        required: false,
      });
    case 'user':
      return Property.ShortText({
        displayName: field.name,
        description: description ?? 'Email address or user ID of a workspace member.',
        required: false,
      });
    default:
      return Property.ShortText({ displayName: field.name, description, required: false });
  }
}

function cleanFields({ values }: { values: Record<string, unknown> }): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => {
      if (value === null || value === undefined || value === '') {
        return false;
      }
      return !(Array.isArray(value) && value.length === 0);
    }),
  );
}

export const rowflareProps = {
  base,
  table,
  view,
  sortField,
  recordId,
  fields,
  cleanFields,
};

const WRITABLE_TYPES = ['text', 'longText', 'email', 'url', 'phone', 'number', 'singleSelect', 'multiSelect', 'date', 'checkbox', 'link', 'user'];
