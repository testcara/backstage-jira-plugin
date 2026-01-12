import {
  coreServices,
  createBackendPlugin
} from '@backstage/backend-plugin-api';
import { Router } from 'express';

export const jiraIssuesBackendPlugin = createBackendPlugin({
  pluginId: 'jira-issues',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ httpRouter, config, logger }) {
        logger.info('Jira Issues Backend Plugin initializing...');

        // Check if config is available
        try {
          const jiraToken = config.getOptionalString('integrations.jira.apiToken');
          const jiraUrl = config.getOptionalString('integrations.jira.baseUrl');
          logger.info(`Jira config check - URL: ${jiraUrl ? 'found' : 'missing'}, Token: ${jiraToken ? 'found' : 'missing'}`);
        } catch (error) {
          logger.error('Failed to read Jira config', error);
        }

        const router = Router();
        router.use((_req, _res, next) => {
          logger.info('[Jira Backend] Middleware hit!');
          next();
        });

        // Test route
        router.get('/test', async (_req, res) => {
          logger.info('[Jira Backend] Test route hit!');
          res.json({ message: 'Jira backend is working!' });
        });

        // GET /issues/:projectKey
        router.get('/issues/:projectKey', async (req, res) => {
          logger.info(`[Jira Backend] Issues route hit for project: ${req.params.projectKey}`);
          try {
            const jiraToken = config.getString('integrations.jira.apiToken');
            const jiraUrl = config.getString('integrations.jira.baseUrl');

            // Filter out closed/resolved issues
            const jqlQuery = `project=${req.params.projectKey} AND status NOT IN (Closed, Resolved, Done)`;

            // Fetch all issues by increasing maxResults
            const maxResults = 1000; // Jira API max is 1000 per request
            const url = `${jiraUrl}/rest/api/2/search?jql=${encodeURIComponent(jqlQuery)}&maxResults=${maxResults}`;

            logger.info(`[Jira Backend] Fetching issues for project: ${req.params.projectKey}`);
            logger.info(`[Jira Backend] URL: ${url}`);

            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${jiraToken}`,
                Accept: 'application/json',
              },
            });

            logger.info(`[Jira Backend] Response status: ${response.status}`);

            if (!response.ok) {
              const errorText = await response.text();
              logger.error(`[Jira Backend] Error response:`, errorText);
              return res.status(response.status).json({
                error: `Jira API error: ${response.status}`,
                details: errorText
              });
            }

            const data = await response.json();
            logger.info(`[Jira Backend] Found ${data.issues?.length || 0} issues out of ${data.total || 0} total`);
            res.json(data);
          } catch (error) {
            logger.error('[Jira Backend] Error:', error);
            res.status(500).json({
              error: 'Internal server error',
              message: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        });

        logger.info('Jira Issues Backend Plugin: registering router');
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/test',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/issues',
          allow: 'unauthenticated',
        });
        logger.info('Jira Issues Backend Plugin: initialization complete');
      },
    });
  },
});
