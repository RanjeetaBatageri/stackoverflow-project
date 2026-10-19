import { useState, useEffect, createContext, useContext } from "react";
import axiosInstance from "./axiosinstance";
import { toast } from "react-toastify";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });
  const [subscription, setSubscription] = useState(null);
  const [loading, setloading] = useState(false);
  const [error, seterror] = useState(null);

  const fetchSubscription = async () => {
    if (!user || !user.token) return;
    try {
      const res = await axiosInstance.get("/subscription/my-subscription");
      setSubscription(res.data);
      // Update local user state with current plan/badge if needed
      if (res.data.plan && user.plan !== res.data.plan) {
        const updatedUser = { ...user, plan: res.data.plan, subscriptionStatus: res.data.subscriptionStatus };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setUser(null);
        setSubscription(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("user");
        }
      } else {
        console.error("Fetch subscription error:", err);
      }
    }
  };

  useEffect(() => {
    if (user && user.token) {
      fetchSubscription();
    } else {
      setSubscription(null);
    }
  }, [user?._id, user?.token]);

  useEffect(() => {
    const handleAuthLogout = () => {
      setUser(null);
      setSubscription(null);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("auth-logout", handleAuthLogout);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("auth-logout", handleAuthLogout);
      }
    };
  }, []);


  const Signup = async ({ name, email, password }) => {
    setloading(true);
    seterror(null);
    try {
      const res = await axiosInstance.post("/user/signup", {
        name,
        email,
        password,
      });
      const { data, token } = res.data;
      const userData = { ...data, token };
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      toast.success("Signup Successful");
    } catch (error) {
      const msg = error.response?.data?.message || "Signup failed";
      seterror(msg);
      toast.error(msg);
    } finally {
      setloading(false);
    }
  };

  const Login = async ({ email, password }) => {
    setloading(true);
    seterror(null);
    try {
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "Web Browser";
      const browserMatch = userAgent.match(/(firefox|msie|chrome|safari|trident|edg)\/?\s*(\d+)/i) || ["", "Browser"];
      const osMatch = userAgent.match(/(windows|macintosh|linux|android|iphone|ipad)/i) || ["", "OS"];

      const res = await axiosInstance.post("/user/login", {
        email,
        password,
        browser: browserMatch[1],
        os: osMatch[1],
        deviceType: /mobile|android|iphone|ipad/i.test(userAgent) ? "mobile" : "desktop",
      });

      if (res.data.requiresDeviceOtp) {
        return res.data;
      }

      const { data, token, sessionId } = res.data;
      const userData = { ...data, token, sessionId };
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      toast.success("Login Successful");
      return res.data;
    } catch (error) {
      const msg = error.response?.data?.message || "Login failed";
      seterror(msg);
      toast.error(msg);
      throw error;
    } finally {
      setloading(false);
    }
  };

  const Logout = () => {
    setUser(null);
    setSubscription(null);
    localStorage.removeItem("user");
    toast.info("Logged out");
    if (typeof window !== "undefined") {
      const protectedPaths = ["/ask", "/users/security"];
      const currentPath = window.location.pathname;
      if (protectedPaths.some(path => currentPath.startsWith(path)) || currentPath.includes("/users/")) {
        window.location.href = "/auth";
      }
    }
  };

  const updateUserState = (updatedFields) => {
    const updatedUser = { ...user, ...updatedFields };
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
    fetchSubscription();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        fetchSubscription,
        updateUserState,
        Signup,
        Login,
        Logout,
        loading,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
