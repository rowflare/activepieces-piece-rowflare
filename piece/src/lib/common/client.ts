import {
  AuthenticationType,
  httpClient,
  HttpMethod,
  QueryParams,
} from '@activepieces/pieces-common';
import { AppConnectionValueForAuthProperty } from '@activepieces/pieces-framework';
import { rowflareAuth } from '../auth';

async function request<T>({
  auth,
  method,
  path,
  query,
  body,
}: {
  auth: RowflareAuthValue;
  method: HttpMethod;
  path: string;
  query?: QueryParams;
  body?: Record<string, unknown>;
}): Promise<T> {
  const response = await httpClient.sendRequest<T>({
    method,
    url: `${apiBase(auth)}${path}`,
    authentication: { type: AuthenticationType.BEARER_TOKEN, token: auth.props.api_token },
    queryParams: query,
    body,
  });
  return response.body;
}

async function listBases({ auth }: { auth: RowflareAuthValue }): Promise<RowflareBase[]> {
  const response = await request<{ bases: RowflareBase[] }>({ auth, method: HttpMethod.GET, path: '/bases' });
  return response.bases;
}

async function listTables({ auth, baseId }: { auth: RowflareAuthValue; baseId: string }): Promise<RowflareTable[]> {
  const response = await request<{ tables: RowflareTable[] }>({
    auth,
    method: HttpMethod.GET,
    path: `/bases/${encodeURIComponent(baseId)}/tables`,
  });
  return response.tables;
}

async function getTable({
  auth,
  baseId,
  tableId,
}: {
  auth: RowflareAuthValue;
  baseId: string;
  tableId: string;
}): Promise<RowflareTable | undefined> {
  const tables = await listTables({ auth, baseId });
  return tables.find((table) => table.id === tableId || table.name === tableId);
}

async function listRecords({
  auth,
  baseId,
  tableId,
  filterByFormula,
  view,
  sortField,
  sortDirection,
  maxRecords,
}: {
  auth: RowflareAuthValue;
  baseId: string;
  tableId: string;
  filterByFormula?: string;
  view?: string;
  sortField?: string;
  sortDirection?: string;
  maxRecords?: number;
}): Promise<RowflareRecord[]> {
  const records: RowflareRecord[] = [];
  let offset: string | undefined;
  do {
    const remaining = maxRecords === undefined ? PAGE_SIZE : Math.min(PAGE_SIZE, maxRecords - records.length);
    const query: QueryParams = { pageSize: String(remaining) };
    if (offset) query['offset'] = offset;
    if (filterByFormula) query['filterByFormula'] = filterByFormula;
    if (view) query['view'] = view;
    if (sortField) {
      query['sort[0][field]'] = sortField;
      query['sort[0][direction]'] = sortDirection === 'desc' ? 'desc' : 'asc';
    }
    if (maxRecords !== undefined) query['maxRecords'] = String(maxRecords);
    const page = await request<{ records: RowflareRecord[]; offset?: string }>({
      auth,
      method: HttpMethod.GET,
      path: recordsPath({ baseId, tableId }),
      query,
    });
    records.push(...page.records);
    offset = page.offset;
  } while (offset !== undefined && (maxRecords === undefined || records.length < maxRecords));
  return maxRecords === undefined ? records : records.slice(0, maxRecords);
}

function recordsPath({ baseId, tableId, recordId }: { baseId: string; tableId: string; recordId?: string }): string {
  const path = `/${encodeURIComponent(baseId)}/${encodeURIComponent(tableId)}`;
  return recordId === undefined ? path : `${path}/${encodeURIComponent(recordId)}`;
}

function parseRecordId(value: unknown): string {
  const id = String(value ?? '').trim();
  if (!/^\d+$/.test(id)) {
    throw new Error(`Record ID must be a whole number such as 17, got "${id}"`);
  }
  return id;
}

function apiBase(auth: RowflareAuthValue): string {
  return `${auth.props.base_url.trim().replace(/\/+$/, '')}/api/v1`;
}

export const rowflareClient = {
  request,
  listBases,
  listTables,
  getTable,
  listRecords,
  recordsPath,
  parseRecordId,
  apiBase,
};

const PAGE_SIZE = 100;

export type RowflareAuthValue = AppConnectionValueForAuthProperty<typeof rowflareAuth>;

export type RowflareBase = {
  id: string;
  name: string;
  permissionLevel: string;
};

export type RowflareField = {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: { choices?: { id: string; name: string }[]; includeTime?: boolean };
};

export type RowflareTable = {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: RowflareField[];
  views: { id: string; name: string; type: string }[];
};

export type RowflareRecord = {
  id: number;
  createdTime: string;
  fields: Record<string, unknown>;
};
