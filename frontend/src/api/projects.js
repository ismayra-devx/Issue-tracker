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
};

export default projectsApi;
