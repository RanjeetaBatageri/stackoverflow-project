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
    if (!user) return;
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
      console.error("Fetch subscription error:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setSubscription(null);
    }
  }, [user?._id]);

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
      const res = await axiosInstance.post("/user/login", {
        email,
        password,
      });
      const { data, token } = res.data;
      const userData = { ...data, token };
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      toast.success("Login Successful");
    } catch (error) {
      const msg = error.response?.data?.message || "Login failed";
      seterror(msg);
      toast.error(msg);
    } finally {
      setloading(false);
    }
  };

  const Logout = () => {
    setUser(null);
    setSubscription(null);
    localStorage.removeItem("user");
    toast.info("Logged out");
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
