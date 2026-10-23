// Prepares a fresh Rowflare instance for test/live.mjs: signs up the first account (the owner),
// creates a base from the "Project tracker" template and a personal access token.
// Prints shell exports: eval "$(node test/setup-rowflare.mjs http://127.0.0.1:8787)"
const url = process.argv[2] || 'http://127.0.0.1:8787';
let cookie = '';

async function call(method, path, body) {
	const res = await fetch(url + path, {
		method,
		headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-rf': '1', ...(cookie ? { Cookie: cookie } : {}) },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const setCookie = res.headers.get('set-cookie');
	if (setCookie) cookie = setCookie.split(';')[0];
	const text = await res.text();
	if (!res.ok) throw new Error(`${method} ${path} failed with ${res.status}: ${text}`);
	return text ? JSON.parse(text) : null;
}

await call('POST', '/api/auth/signup', { name: 'Owner', email: 'owner@example.com', password: 'correct-horse-42' });
const [workspace] = await call('GET', '/api/workspaces');
const base = await call('POST', `/api/workspaces/${workspace.id}/bases`, { template: 'project-tracker' });
const { token } = await call('POST', '/api/tokens', { name: 'piece tests' });
console.log(`export ROWFLARE_URL=${url} ROWFLARE_BASE=${base.id} ROWFLARE_TOKEN=${token}`);
