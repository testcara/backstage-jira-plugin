# @testcara/plugin-jira-issues-backend

Backend plugin for Jira Issues integration in Backstage.

See the [main README](../README.md) for full documentation.

## Installation

```bash
yarn workspace backend add @testcara/plugin-jira-issues-backend
```

Register in `packages/backend/src/index.ts`:

```typescript
import { jiraIssuesBackendPlugin } from '@testcara/plugin-jira-issues-backend';

backend.add(jiraIssuesBackendPlugin);
```

## Configuration

Add to `app-config.yaml`:

```yaml
integrations:
  jira:
    baseUrl: https://your-jira-instance.com
    apiToken: ${JIRA_TOKEN}
```

## API Endpoints

- `GET /api/jira-issues/test` - Health check
- `GET /api/jira-issues/issues/:projectKey` - Fetch issues for a project

## License

Apache-2.0
