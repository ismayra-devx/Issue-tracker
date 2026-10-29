import client from './client';

export const projectsApi = {
  list: () =>
    client.get('/projects'),

  create: ({ name, description }) =>
    client.post('/projects', {
      name,
      ...(description ? { description } : {}),
    }),

  getById: (id) =>
    client.get(`/projects/${id}`),

  getMembers: (id) =>
    client.get(`/projects/${id}/members`),

  addMember: (id, email) =>
    client.post(`/projects/${id}/members`, { email }),

  getLabels: (id) =>
    client.get(`/projects/${id}/labels`),

  createLabel: (id, { name, color }) =>
    client.post(`/projects/${id}/labels`, { name, color }),
};

export default projectsApi;
