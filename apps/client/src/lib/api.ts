import { useAuth } from "@clerk/react";
import axios, { AxiosError, type AxiosInstance } from "axios";
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
    instance.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ error?: string; detail?: string }>) => {
        const detail = error.response?.data?.detail ?? error.response?.data?.error;
        if (detail) {
          error.message = detail;
        }
        return Promise.reject(error);
      },
    );
    return instance;
    // getToken identity is stable per Clerk session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
