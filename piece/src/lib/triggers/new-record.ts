import { DedupeStrategy, Polling, pollingHelper } from '@activepieces/pieces-common';
import {
  AppConnectionValueForAuthProperty,
  createTrigger,
  Property,
  StaticPropsValue,
  TriggerStrategy,
} from '@activepieces/pieces-framework';
import { rowflareAuth } from '../auth';
import { rowflareClient } from '../common/client';
import { rowflareProps } from '../common/props';

const props = {
  base: rowflareProps.base,
  table: rowflareProps.table,
  view: rowflareProps.view,
  formula: Property.ShortText({
    displayName: 'Filter Formula',
    description: 'Only trigger for new records for which this formula is true, for example {Status} = "Review". Leave empty for every new record.',
    required: false,
  }),
};

const polling: Polling<AppConnectionValueForAuthProperty<typeof rowflareAuth>, StaticPropsValue<typeof props>> = {
  strategy: DedupeStrategy.TIMEBASED,
  items: async ({ auth, propsValue, lastFetchEpochMS }) => {
    const records = await rowflareClient.listRecords({
      auth,
      baseId: propsValue.base,
      tableId: propsValue.table,
      view: propsValue.view || undefined,
      filterByFormula: createdSince({ epochMs: lastFetchEpochMS, formula: propsValue.formula }),
      maxRecords: lastFetchEpochMS > 0 ? undefined : TEST_SAMPLE_LIMIT,
    });
    return records.map((record) => ({
      epochMilliSeconds: Date.parse(record.createdTime),
      data: record,
    }));
  },
};

export const newRecordTrigger = createTrigger({
  auth: rowflareAuth,
  name: 'new_record',
  classification: 'READ',
  displayName: 'New Record',
  description: 'Triggers when a record is created in the selected table.',
  aiMetadata: {
    description:
      'Fires once per record created in the selected Rowflare table, optionally limited to a view or a formula, by polling on each record\'s creation time.',
  },
  props,
  sampleData: {
    id: 17,
    createdTime: '2026-10-13T01:57:43.000Z',
    fields: { Name: 'Ship landing page', Status: 'Done', Estimate: 8 },
  },
  type: TriggerStrategy.POLLING,
  async test(context) {
    return pollingHelper.test(polling, context);
  },
  async onEnable(context) {
    await pollingHelper.onEnable(polling, context);
  },
  async onDisable(context) {
    await pollingHelper.onDisable(polling, context);
  },
  async run(context) {
    return pollingHelper.poll(polling, context);
  },
});

function createdSince({ epochMs, formula }: { epochMs: number; formula?: string }): string | undefined {
  const since = epochMs > 0 ? `IS_AFTER(CREATED_TIME(), DATETIME_PARSE("${new Date(epochMs).toISOString()}"))` : undefined;
  const extra = formula?.trim() || undefined;
  if (since && extra) {
    return `AND(${since}, ${extra})`;
  }
  return since ?? extra;
}

const TEST_SAMPLE_LIMIT = 500;
