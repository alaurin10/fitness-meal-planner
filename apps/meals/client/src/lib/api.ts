import { useAuth } from "@clerk/clerk-react";
import axios, { type AxiosInstance } from "axios";
import { useMemo } from "react";

const BASE_URL = import.meta.env.VITE_API_URL;

export function useApi(): AxiosInstance {
  const { getToken } = useAuth();

  return useMemo(() => {
    const instance = axios.create({ baseURL: BASE_URL });
    instance.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return instance;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
