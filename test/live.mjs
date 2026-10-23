// Live test of the bundled piece (piece/dist/src/index.js) against a real Rowflare instance.
// Actions, dropdowns, dynamic fields, auth validation and the polling trigger run their real code;
// only the Activepieces context (auth value, props, store) is supplied here.
//
// Usage: ROWFLARE_URL=http://127.0.0.1:8787 ROWFLARE_TOKEN=rf_... ROWFLARE_BASE=app... node test/live.mjs
// The base must be made from the "Project tracker" template (it uses the Tasks table).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { rowflare } = require('../piece/dist/src/index.js');

const url = process.env.ROWFLARE_URL;
const token = process.env.ROWFLARE_TOKEN;
const baseId = process.env.ROWFLARE_BASE;
if (!url || !token || !baseId) throw new Error('Set ROWFLARE_URL, ROWFLARE_TOKEN and ROWFLARE_BASE');

const auth = { type: 'CUSTOM_AUTH', props: { base_url: `${url}/`, api_token: token } };
const memoryStore = () => {
	const data = new Map();
	return {
		get: async (k) => (data.has(k) ? data.get(k) : null),
		put: async (k, v) => { data.set(k, v); return v; },
		delete: async (k) => { data.delete(k); },
	};
};
const action = (name) => rowflare.getAction(name);
const run = (name, propsValue) => action(name).run({ auth, propsValue, store: memoryStore() });

let passed = 0;
async function test(name, fn) {
	await fn();
	passed++;
	console.log(`PASS ${name}`);
}

const created = [];
let tasksId;

{
	const leftovers = await run('find_records', { base: baseId, table: 'Tasks', formula: 'OR(SEARCH("AP live", {Name}), SEARCH("AP trigger", {Name}), {Name} = "AP small", {Name} = "AP big")' });
	for (const r of leftovers) await run('delete_record', { base: baseId, table: 'Tasks', record_id: r.id });
	if (leftovers.length) console.log(`cleaned up ${leftovers.length} records from an earlier run`);
}
let fieldIds;

await test('piece metadata: five actions plus custom API call, one trigger', async () => {
	assert.deepEqual(Object.keys(rowflare.actions()).sort(), ['create_record', 'custom_api_call', 'delete_record', 'find_records', 'get_record', 'update_record']);
	assert.deepEqual(Object.keys(rowflare.triggers()), ['new_record']);
	for (const a of Object.values(rowflare.actions())) assert.ok(a.classification, `${a.name} has classification`);
});

await test('auth validate: good token valid, bad token invalid', async () => {
	const ok = await rowflare.auth.validate({ auth: { base_url: url, api_token: token } });
	assert.equal(ok.valid, true);
	const bad = await rowflare.auth.validate({ auth: { base_url: url, api_token: 'rf_wrong' } });
	assert.equal(bad.valid, false);
});

await test('dropdowns: base, table, view, sort field', async () => {
	const props = action('find_records').props;
	const bases = await props.base.options({ auth });
	assert.ok(bases.options.some((o) => o.value === baseId));
	const none = await props.table.options({ auth });
	assert.equal(none.disabled, true, 'table dropdown waits for a base');
	const tables = await props.table.options({ auth, base: baseId });
	tasksId = tables.options.find((o) => o.label === 'Tasks').value;
	const views = await props.view.options({ auth, base: baseId, table: tasksId });
	assert.ok(views.options.length >= 1);
	const sorts = await props.sort_field.options({ auth, base: baseId, table: tasksId });
	assert.ok(sorts.options.some((o) => o.label === 'Estimate'));
});

await test('dynamic fields: writable fields only, typed inputs', async () => {
	const dyn = await action('create_record').props.fields.props({ auth, base: baseId, table: tasksId });
	const byName = Object.fromEntries(Object.entries(dyn).map(([id, p]) => [p.displayName, { id, type: p.type }]));
	assert.equal(byName.Estimate.type, 'NUMBER');
	assert.equal(byName.Status.type, 'STATIC_DROPDOWN');
	assert.equal(byName.Tags.type, 'STATIC_MULTI_SELECT_DROPDOWN');
	assert.equal(byName.Done.type, 'CHECKBOX');
	assert.equal(byName.Due.type, 'DATE_TIME');
	assert.equal(byName.Project.type, 'ARRAY');
	assert.equal(byName.Overdue, undefined, 'formula field hidden');
	assert.equal(byName['Project owner'], undefined, 'lookup field hidden');
	fieldIds = Object.fromEntries(Object.entries(byName).map(([n, v]) => [n, v.id]));
});

await test('create record: field ids, typecast, empty values dropped, link by primary value', async () => {
	const out = await run('create_record', {
		base: baseId,
		table: tasksId,
		typecast: true,
		fields: {
			[fieldIds.Name]: 'AP live create',
			[fieldIds.Estimate]: 3,
			[fieldIds.Status]: 'Review',
			[fieldIds.Tags]: ['design', 'engineering'],
			[fieldIds.Done]: true,
			[fieldIds.Due]: '2026-11-02T00:00:00.000Z',
			[fieldIds.Project]: ['Website relaunch'],
			[fieldIds.Notes]: '',
			[fieldIds.Assignee]: undefined,
		},
	});
	assert.equal(out.fields.Name, 'AP live create');
	assert.equal(out.fields.Estimate, 3);
	assert.equal(out.fields.Status, 'Review');
	assert.deepEqual(out.fields.Tags, ['design', 'engineering']);
	assert.equal(out.fields.Done, true);
	assert.equal(out.fields.Due, '2026-11-02');
	assert.deepEqual(out.fields.Project, [1]);
	assert.equal(out.fields.Notes, undefined);
	created.push(out.id);
});

await test('get record (ID given as a number from an earlier step)', async () => {
	const out = await run('get_record', { base: baseId, table: tasksId, record_id: created[0] });
	assert.equal(out.id, created[0]);
	assert.equal(out.fields['Project owner'][0], 'Ava Chen', 'lookup computed');
});

await test('update record: only filled fields change', async () => {
	const out = await run('update_record', {
		base: baseId, table: tasksId, record_id: String(created[0]), typecast: true,
		fields: { [fieldIds.Estimate]: '8', [fieldIds.Name]: '' },
	});
	assert.equal(out.fields.Estimate, 8);
	assert.equal(out.fields.Name, 'AP live create', 'empty Name left unchanged');
});

await test('find records: formula, sort, max records, paging', async () => {
	const second = await run('create_record', { base: baseId, table: 'Tasks', typecast: true, fields: { [fieldIds.Name]: 'AP live second', [fieldIds.Estimate]: 50 } });
	created.push(second.id);
	const found = await run('find_records', {
		base: baseId, table: tasksId, formula: 'SEARCH("AP live", {Name})', sort_field: fieldIds.Estimate, sort_direction: 'desc', max_records: 10,
	});
	assert.deepEqual(found.map((r) => r.fields.Name), ['AP live second', 'AP live create']);
	const all = await run('find_records', { base: baseId, table: tasksId });
	assert.ok(all.length > 100, `all records across pages: ${all.length}`);
	const capped = await run('find_records', { base: baseId, table: tasksId, max_records: 130 });
	assert.equal(capped.length, 130);
	const view = (await action('find_records').props.view.options({ auth, base: baseId, table: tasksId })).options[0].value;
	const inView = await run('find_records', { base: baseId, table: tasksId, view, max_records: 5 });
	assert.equal(inView.length, 5);
});

await test('errors: bad record ID, unknown record', async () => {
	await assert.rejects(run('get_record', { base: baseId, table: tasksId, record_id: 'abc' }), /whole number/);
	await assert.rejects(run('get_record', { base: baseId, table: tasksId, record_id: '99999999' }), (e) => JSON.stringify(e).includes('404') || /404/.test(String(e.message)));
});

await test('custom API call action builds the right base URL', async () => {
	const out = await action('custom_api_call').run({
		auth,
		propsValue: { url: { url: `${url}/api/v1/bases` }, method: 'GET', headers: {}, queryParams: {}, body_type: 'none', body: {}, failsOnError: true, timeout: 0, followRedirects: false },
		store: memoryStore(),
	});
	assert.ok(JSON.stringify(out).includes(baseId));
});

await test('trigger: test returns samples, onEnable then run emits only new records once', async () => {
	const trigger = rowflare.getTrigger('new_record');
	const store = memoryStore();
	const ctx = { auth, propsValue: { base: baseId, table: tasksId }, store, files: {}, isRepublish: false };
	const sample = await trigger.test(ctx);
	assert.ok(sample.length >= 1 && sample[0].id, 'test returns existing records');
	await trigger.onEnable(ctx);
	assert.deepEqual(await trigger.run(ctx), [], 'nothing new right after enabling');
	await new Promise((r) => setTimeout(r, 20));
	const a = await run('create_record', { base: baseId, table: tasksId, fields: { [fieldIds.Name]: 'AP trigger A' } });
	const b = await run('create_record', { base: baseId, table: tasksId, fields: { [fieldIds.Name]: 'AP trigger B' } });
	created.push(a.id, b.id);
	const emitted = await trigger.run(ctx);
	if (process.env.DEBUG) console.log('lastPoll', await store.get('lastPoll'), 'created', a.createdTime, b.createdTime, 'emitted', emitted.length);
	assert.deepEqual(emitted.map((r) => r.fields.Name).sort(), ['AP trigger A', 'AP trigger B']);
	assert.deepEqual(await trigger.run(ctx), [], 'not emitted twice');
});

await test('trigger: filter formula', async () => {
	const trigger = rowflare.getTrigger('new_record');
	const ctx = { auth, propsValue: { base: baseId, table: tasksId, formula: '{Estimate} > 10' }, store: memoryStore(), files: {}, isRepublish: false };
	await trigger.onEnable(ctx);
	await new Promise((r) => setTimeout(r, 20));
	const small = await run('create_record', { base: baseId, table: tasksId, fields: { [fieldIds.Name]: 'AP small', [fieldIds.Estimate]: 1 } });
	const big = await run('create_record', { base: baseId, table: tasksId, fields: { [fieldIds.Name]: 'AP big', [fieldIds.Estimate]: 40 } });
	created.push(small.id, big.id);
	assert.deepEqual((await trigger.run(ctx)).map((r) => r.fields.Name), ['AP big']);
});

await test('delete record', async () => {
	for (const id of created) {
		const out = await run('delete_record', { base: baseId, table: tasksId, record_id: id });
		assert.deepEqual(out, { id, deleted: true });
	}
});

console.log(`\n${passed} tests passed against ${url}`);
