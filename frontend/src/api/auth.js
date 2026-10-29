import client from './client';

export const authApi = {
  login: (email, password) =>
    client.post('/auth/login', { email, password }),

  register: (name, email, password) =>
    client.post('/auth/register', { name, email, password }),

  getMe: () =>
    client.get('/auth/me'),
};

export default authApi;
