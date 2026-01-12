# @testcara/plugin-jira-issues

Frontend plugin for displaying Jira issues in Backstage.

See the [main README](../README.md) for full documentation.

## Installation

```bash
yarn workspace app add @testcara/plugin-jira-issues
```

## Usage

```typescript
import { JiraIssuesCard } from '@testcara/plugin-jira-issues';

<EntityLayout.Route path="/jira" title="Jira">
  <Grid container spacing={3}>
    <Grid item xs={12}>
      <JiraIssuesCard />
    </Grid>
  </Grid>
</EntityLayout.Route>
```

Add annotation to your entities:

```yaml
metadata:
  annotations:
    jira/project-key: MYPROJ
```

## License

Apache-2.0
