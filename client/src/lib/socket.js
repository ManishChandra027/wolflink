import { io } from 'socket.io-client';

function socketOrigin() {
  const configured = import.meta.env.VITE_SOCKET_URL;
  if (configured) return configured;
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl && /^https?:\/\//i.test(apiUrl)) return new URL(apiUrl).origin;
  return window.location.origin;
}

export const chatSocket = io(socketOrigin(), {
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
});
