import axios from "axios";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use((req) => {
  if (typeof window !== "undefined") {
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const token = JSON.parse(user).token;
        if (token) {
          req.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        console.error("Token parse error", e);
      }
    }
  }
  return req;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== "undefined") {
        const currentUser = localStorage.getItem("user");
        if (currentUser) {
          localStorage.removeItem("user");
          window.dispatchEvent(new Event("auth-logout"));
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

