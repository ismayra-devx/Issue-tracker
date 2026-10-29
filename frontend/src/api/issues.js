import client from './client';

export const issuesApi = {
  list: (projectId, params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    return client.get(`/projects/${projectId}/issues${qs ? `?${qs}` : ''}`);
  },

  get: (projectId, number) =>
    client.get(`/projects/${projectId}/issues/${number}`),

  create: (projectId, data) =>
    client.post(`/projects/${projectId}/issues`, data),

  update: (projectId, number, data) =>
    client.patch(`/projects/${projectId}/issues/${number}`, data),

  getComments: (projectId, number) =>
    client.get(`/projects/${projectId}/issues/${number}/comments`),

  addComment: (projectId, number, body) =>
    client.post(`/projects/${projectId}/issues/${number}/comments`, { body }),

  getHistory: (projectId, number) =>
    client.get(`/projects/${projectId}/issues/${number}/history`),
};

export default issuesApi;
