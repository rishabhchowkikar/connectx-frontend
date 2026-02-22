import axios from "axios";

const api = axios.create({
    // baseURL: "http://localhost:5001",
    // baseURL: "https://c0dz0xln-5001.inc1.devtunnels.ms"
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001",
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers["x-auth-token"] = token;
    }
    return config;
});

export default api;