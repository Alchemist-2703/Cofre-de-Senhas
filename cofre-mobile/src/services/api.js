import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Substitua pelo seu IP local (descubra com 'ipconfig' no terminal do Windows)
const LOCAL_IP = '192.168.15.6';

const api = axios.create({
  baseURL: `http://${LOCAL_IP}:8000`,
  timeout: 10000,
});

// Interceptor para injetar o Token JWT automaticamente em cada requisição
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;