# Rowflare piece for Activepieces

An [Activepieces](https://www.activepieces.com) piece for [Rowflare](https://rowflare.com), the open-source (AGPL-3.0) Airtable alternative that you can use hosted at app.rowflare.com or run yourself.

npm package: `@rowflare/piece-rowflare`

## What it does

| Type | Name | What it does |
| --- | --- | --- |
| Trigger | New Record | Runs the flow once for every record created in a table, optionally limited to a view or a formula. Polls on each record's creation time. |
| Action | Create Record | Adds a record. The form shows the table's writable fields with matching inputs (number, checkbox, date, select options, linked records). |
| Action | Update Record | Changes the fields you fill in on a record; the others keep their values. |
| Action | Get Record | Gets a record by its ID. |
| Action | Find Records | Lists records filtered by a formula such as `AND({Status} = "Done", {Estimate} > 5)` and/or a view, sorted by a field, up to a maximum count. |
| Action | Delete Record | Deletes a record by its ID. |
| Action | Custom API Call | Any other call to the [Rowflare REST API](https://github.com/rowflare/rowflare/blob/main/docs/api.md), with the connection's token added. |

Records come back in the Airtable shape: `{ "id": 17, "createdTime": "...", "fields": { "Name": "...", ... } }`. Empty cells are left out of `fields`. Record IDs are whole numbers.

Computed fields (formula, lookup, rollup, created time, last modified time, autonumber) and attachments are not offered in Create and Update, because the API cannot write them. "Convert Values" (on by default) turns text into the field's type, creates unknown select options and links records by their primary field value.

## Install

Platform admins install custom pieces from npm or from a packed archive.

**With the API** (works on every edition, including the free Community Edition): create an API key or use a platform admin's session token, then

```sh
curl -X POST https://your-activepieces/api/v1/pieces \
  -H "Authorization: Bearer $AP_TOKEN" -H "Content-Type: application/json" \
  -d '{"packageType": "REGISTRY", "scope": "PLATFORM", "pieceName": "@rowflare/piece-rowflare", "pieceVersion": "0.1.0"}'
```

To install without npm, upload the archive from a build (`piece/dist/rowflare-piece-rowflare-<version>.tgz`) as multipart form data with `packageType=ARCHIVE`, `scope=PLATFORM`, `pieceName`, `pieceVersion` and `pieceArchive` (the file).

**In the app**: Platform admin, Pieces, **Install Piece**, package type "NPM Registry", name `@rowflare/piece-rowflare` and the version. On Activepieces 0.92.3 Community Edition this page is locked (the plan's `managePiecesEnabled` is false), so use the API there.

## Connect

1. In Rowflare, open **Settings**, **API tokens**, and create a token (it starts with `rf_` and is shown once).
2. In Activepieces, add a Rowflare connection: **Instance URL** stays `https://app.rowflare.com` for the hosted service, or the address of your own instance; **API Token** is the token.

The connection is checked by listing your bases. A token acts as the user who created it, so a viewer's token can read but not write.

## Build

Activepieces pieces are built inside the Activepieces repository: its CLI bundles the framework libraries into the piece (they are not published to npm). `scripts/build-in-monorepo.sh` does this:

```sh
# Needs Node 22+, bun 1.4 and a checkout of activepieces/activepieces (see ACTIVEPIECES_REF in .github/workflows/ci.yml)
scripts/build-in-monorepo.sh ../activepieces
ls piece/dist   # package.json, src/index.js, rowflare-piece-rowflare-<version>.tgz
```

The script copies `piece/` to `packages/pieces/community/rowflare`, registers it in `tsconfig.base.json`, runs `bun install`, `turbo run build` and `turbo run lint` for the piece, then `npm run build-piece rowflare`.

## Test

`test/live.mjs` loads the bundled piece and runs every action, dropdown, the dynamic field form, the connection check and the trigger against a real Rowflare instance:

```sh
docker run -d --name rowflare-test -p 8787:8787 -e SECRET_KEY=test rowflare/rowflare:0.1.0
eval "$(node test/setup-rowflare.mjs http://127.0.0.1:8787)"   # owner account, "Project tracker" base, token
node test/live.mjs
docker rm -fv rowflare-test
```

CI (`.github/workflows/ci.yml`) does the same with Rowflare as a service container.

## Release

Bump `version` in `piece/package.json`, push a tag `v<version>`. `.github/workflows/publish.yml` builds the piece and runs `npm publish --provenance --access public` from `piece/dist`. See the comments in that file for npm authentication (token secret `NPM_TOKEN`, or npm trusted publishing after the first release).

## License

MIT for this piece. Rowflare itself is AGPL-3.0.
