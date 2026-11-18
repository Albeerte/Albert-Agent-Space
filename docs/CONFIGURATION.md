# Configuration and operations

[Back to README](../README.md)

## Local settings

`npm run setup` generates `.env` with random owner, encryption, and agent credentials. Never commit this file. The app loads it through `npm start`.

| Variable | Purpose |
| --- | --- |
| `OFFICE_HOST`, `OFFICE_PORT` | Bind address and port; native defaults `127.0.0.1:8787`. |
| `OFFICE_DATA` | SQLite, worktrees, local documents, and backup directory; default `data`. |
| `OFFICE_PASSWORD` | Owner password. Required outside loopback demo mode. |
| `OFFICE_MASTER_KEY` | Server encryption key for stored provider credentials. Keep with private backups. |
| `OFFICE_AGENT_TOKEN` | Restricted corporate agent API credential; not an owner login. |
| `OFFICE_ORIGIN` | Expected browser origin when behind a reverse proxy. |
| `OFFICE_DEMO` | `1` enables labeled demo workflows. |
| `OFFICE_BACKUPS`, `OFFICE_BACKUP_DIR` | Enable periodic consistent snapshots and optionally choose their directory. |
| `OFFICE_OLLAMA_URL` | Approved local Ollama address. |
| `OFFICE_LM_STUDIO_URL` | Approved local LM Studio address. |
| `OFFICE_PRIVATE_PROVIDER`, `OFFICE_PRIVATE_MODEL` | Private local inference defaults. |

For remote hosting, configure an HTTPS reverse proxy, a nonempty owner password, persistent data, and `OFFICE_ORIGIN=https://your-domain.example`. The supplied Compose port remains bound to localhost. Run only one Office server against a data directory.

## Model profiles

Profiles are created in the app. Multiple profiles can share a provider. An agent receives a primary profile, an optional backup, and an explicit paid-fallback flag. The connection test reports a real result; a configured profile does not imply a working service.

Native local addresses:

```text
Ollama:    http://127.0.0.1:11434
LM Studio: http://127.0.0.1:1234/v1
```

From Compose, use `http://ollama:11434` or the configured `http://host.docker.internal:1234/v1`. Keep local-only profiles local: redirects, unsupported cloud models, and unapproved external hosts fail rather than silently falling back. Cloud model availability and pricing are provider-defined.

## GitHub tasks

Configure `OFFICE_GITHUB_TOKEN` for the repositories you choose and set `OFFICE_GITHUB_REPOS` to an explicit JSON allowlist:

```json
{"owner/repo":{"paths":["src/example.js"],"create":["src/new-helper.js"],"image":"node:24-bookworm-slim","test":["node","--test"]}}
```

`paths` lists editable existing files; `create` lists explicitly permitted new files. A task handles up to eight UTF-8 files, each up to 50 KB. Traversal, symlinks, repository metadata, and Windows reserved paths are rejected. The token needs contents/pull-request write and issue read permissions for those repositories.

For real tests, run Office **natively** with the Docker CLI, set `OFFICE_DOCKER_TESTS=1`, and prepare a test image that already contains dependencies. Tests run without networking or secrets in a resource-limited container. The default Compose Office service does not mount the Docker daemon. Demo tasks use the built-in local test repository.

Draft PR creation requires the owner to approve the current result fingerprint. A new attempt invalidates the previous approval. Merge and production deployment endpoints do not exist in 0.8.0.

## Paperclip and OpenClaw

Optional services are independent deployments. Fetch pinned sources and use the supplied optional Compose profiles:

```sh
npm run upstream
docker compose -f compose.yaml -f compose.upstream.yaml --profile paperclip --profile openclaw up --build -d
```

Paperclip: `http://127.0.0.1:3100`. OpenClaw: `http://127.0.0.1:18789`. Complete upstream onboarding and configure the company, agents, model accounts, and access policies separately. Private Office data volumes are not mounted into these services.

Paperclip settings: `PAPERCLIP_URL`, `PAPERCLIP_COMPANY_ID`, `PAPERCLIP_TOKEN`, and `PAPERCLIP_AGENT_MAP`. Map the pipeline agents to actual remote agent IDs, for example:

```json
{"cto":"remote-cto","tech":"remote-tech","backend":"remote-dev","frontend":"remote-front","test":"remote-test","qa":"remote-qa","devops-agent":"remote-devops","head-ai":"remote-head","evaluation":"remote-eval"}
```

Office stores one canonical task per linked issue. The sync outbox survives restarts and retries failed remote updates; the two databases do not share an atomic transaction. Configure independent upstream triggers to avoid duplicate execution.

For OpenClaw, enable its chat-completions gateway endpoint and configure its official provider authentication through upstream onboarding. An Office profile points to the gateway `/v1` URL, token, remote agent ID, and backend model. Office sends `model=openclaw/<agentId>` with `x-openclaw-model`. Your upstream tool policy remains responsible for the tools independently available to that remote agent.

Additional adapters and optional Python SDK workers are documented in [PROJECTS.md](../PROJECTS.md). Their protocol fixtures do not establish that every upstream service is running.

## Backup and recovery

```sh
npm run backup
```

Periodic backups are enabled by default; a consistent snapshot is retained per UTC day. Older snapshots are not automatically deleted. Back up both your database and the original encryption key in a private location. A backup on the same disk does not cover loss of that disk.

To restore, stop the server, retain the current data directory, copy a snapshot as `office.sqlite` into a new directory, and point `OFFICE_DATA` there. Keep the original `OFFICE_MASTER_KEY`. Do not replace an active database file while the server is running.

`docker compose down` preserves named volumes. `docker compose down -v` removes them.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Port is occupied | Set `OFFICE_PORT` to another port before starting. |
| Login rejected | Read your local `.env` owner password; setup preserves previous credentials. |
| Local model unavailable | Start the local service, install the chosen model, and test that profile in Settings. |
| Cloud request fails | Inspect the profile error; verify model ID, key, base URL, and provider access. |
| Task cannot edit a file | Check its exact existing/new file allowlist entry. |
| Real tests cannot run | Check native Docker CLI access, `OFFICE_DOCKER_TESTS`, and the prepared test image. |
| Data appears missing | Verify `OFFICE_DATA` or the named volume used by this instance. |

Run `npm run doctor` to inspect readiness without displaying credentials. Run `npm run smoke` only when creating synthetic demo records in the current instance is acceptable.
