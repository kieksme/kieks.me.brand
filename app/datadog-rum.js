import { datadogRum } from '@datadog/browser-rum';

datadogRum.init({
  applicationId: 'fde38120f37fb3061349fd252df5b60a49af82e2',
  clientToken: 'pub579a3deef96dd8544db409bd4257b3dc',
  site: 'datadoghq.eu',
  service: 'frontend',
  env: 'prod',
  version: '1.0.0',

  trackResources: true,
  trackLongTasks: true,
  trackUserInteractions: true,

  sampleRate: 100,
  tracingSampleRate: 100,
});
