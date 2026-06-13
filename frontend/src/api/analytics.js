import client from './client'

export const analyticsApi = {
  etlLogs: (params) => client.get('/analytics/etl-logs/', { params }).then((r) => r.data),

  modelMetrics: (params) => client.get('/analytics/model-metrics/', { params }).then((r) => r.data),

  profDashboard: (params) => client.get('/analytics/dashboard/prof/', { params }).then((r) => r.data),

  profProfileStats: () => client.get('/analytics/prof/profile-stats/').then((r) => r.data),

  adminDashboard: () => client.get('/analytics/dashboard/admin/').then((r) => r.data),
}
