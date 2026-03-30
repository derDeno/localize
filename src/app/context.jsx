import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "./utils";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [bootstrap, setBootstrap] = useState({
    loading: true,
    user: null,
    settings: null,
    error: "",
  });

  async function refreshBootstrap() {
    setBootstrap((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = await apiFetch("/api/bootstrap");
      setBootstrap({
        loading: false,
        user: payload.user,
        settings: payload.settings,
        error: "",
      });
      return payload;
    } catch (error) {
      setBootstrap({
        loading: false,
        user: null,
        settings: null,
        error: error.message,
      });
      throw error;
    }
  }

  useEffect(() => {
    refreshBootstrap();
  }, []);

  const value = useMemo(
    () => ({
      ...bootstrap,
      refreshBootstrap,
      setBootstrap,
    }),
    [bootstrap],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
