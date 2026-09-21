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

export default axiosInstance;
