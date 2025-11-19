import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const getPreferredSystemTheme = () => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

// Order of theme preferences.
// 1. What the user has selected in the app.
// 2. Set in the system settings.
// 3. Default light mode.
export const getPreferredTheme = () => {
  return localStorage.getItem("theme") || getPreferredSystemTheme() || "light";
};

interface Theme {
  theme: string;
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const ThemeContext = createContext<Theme>({
  theme: "light",
  toggleTheme: () => {
    // noop
  },
  setTheme: () => {
    // noop
  },
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<string>(() => getPreferredTheme());

  const applyTheme = useCallback((newTheme: string) => {
    setThemeState(newTheme);
    // remove both light and dark classes so that only the saved theme is really used.
    document.documentElement.classList.remove("light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add(newTheme);
  }, []);

  useEffect(() => {
    const savedTheme = getPreferredTheme();
    applyTheme(savedTheme);
  }, [applyTheme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    // we only store the new theme into the local storage on toggle, as this is an in-app setting.
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  const setTheme = (newTheme: "light" | "dark" | "system") => {
    if (newTheme === "system") {
      const systemTheme = getPreferredSystemTheme();
      localStorage.removeItem("theme");
      applyTheme(systemTheme);
    } else {
      localStorage.setItem("theme", newTheme);
      applyTheme(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
