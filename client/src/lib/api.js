import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';
export const api = axios.create({ baseURL, withCredentials: true });
const refreshClient = axios.create({ baseURL, withCredentials: true });
let refreshRequest;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const isAuthEndpoint = /^\/auth\/(login|register|refresh|logout)(?:$|\?)/.test(request?.url || '');
    if (error.response?.status !== 401 || !request || request._retried || isAuthEndpoint) {
      return Promise.reject(error);
    }

    request._retried = true;
    try {
      refreshRequest ||= refreshClient.post('/auth/refresh').finally(() => {
        refreshRequest = undefined;
      });
      await refreshRequest;
      return api(request);
    } catch (refreshError) {
      window.dispatchEvent(new Event('wolflink:session-expired'));
      return Promise.reject(refreshError);
    }
  },
);

export function getApiMessage(error) {
  return error.response?.data?.error?.message || 'We couldn’t reach WolfLink. Check your connection and try again.';
}
