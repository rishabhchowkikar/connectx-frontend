import axios from "axios";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001",
    withCredentials: true, // Enable cookie-based authentication
});

// No need for token interceptor - cookies are sent automatically with withCredentials: true
export default api;