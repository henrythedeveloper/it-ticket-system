// src/store/themeStore.ts
// ==========================================================================
// Zustand store for managing the application theme (light/dark).
// Persists the selected theme to localStorage.
// ==========================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// --- Types ---

/**
 * Defines the possible theme values.
 */
type Theme = 'light' | 'dark';

/**
 * Defines the shape of the theme store, including state and actions.
 */
interface ThemeStore {
    theme: Theme;
    initializeTheme: () => void; // Action to set initial theme
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

// --- Helper Function ---

/**
 * Gets the preferred theme based on system settings.
 * @returns 'dark' or 'light' based on `prefers-color-scheme`.
 */
const getSystemPreference = (): Theme => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
    }
    return 'light';
};

// --- Store Implementation ---

/**
 * Zustand store for theme management.
 * - Manages `theme` state ('light' or 'dark').
 * - Provides `initializeTheme`, `toggleTheme`, `setTheme` actions.
 * - Persists the `theme` state to localStorage.
 */
export const useThemeStore = create<ThemeStore>()(
    persist(
    (set, get) => ({
        // --- Initial State ---
        // Default to 'light', but `initializeTheme` will override this on load
        theme: 'light',

        // --- Actions ---
        /**
         * Initializes the theme based on localStorage or system preference.
         * Should be called once when the app loads (e.g., in ThemeContext).
         */
        initializeTheme: () => {
        const storedTheme = localStorage.getItem('theme'); // Raw value from storage
            // Note: Persistence middleware handles hydration, but we need to check
            // if the hydrated value is valid or if we need to fall back to system pref.
        const currentTheme = get().theme; // Theme possibly hydrated by middleware

        if (storedTheme === 'light' || storedTheme === 'dark') {
            // If a valid theme is already in the store (likely from storage), ensure state matches
            if (currentTheme !== storedTheme) {
                set({ theme: storedTheme });
                console.log(`ThemeStore: Initialized theme from storage: ${storedTheme}`);
            } else {
                console.log(`ThemeStore: Theme already hydrated from storage: ${currentTheme}`);
            }
        } else {
            // No valid theme in storage/state, use system preference
            const systemTheme = getSystemPreference();
            set({ theme: systemTheme });
            console.log(`ThemeStore: Initialized theme from system preference: ${systemTheme}`);
        }
        },

        /**
         * Toggles the theme between 'light' and 'dark'.
         */
        toggleTheme: () => {
        set((state) => {
            const newTheme = state.theme === 'light' ? 'dark' : 'light';
            console.log(`ThemeStore: Toggling theme to ${newTheme}`);
            return { theme: newTheme };
        });
        },

        /**
         * Explicitly sets the theme.
         * @param theme - The theme to set ('light' or 'dark').
         */
        setTheme: (theme) => {
        if (theme === 'light' || theme === 'dark') {
            console.log(`ThemeStore: Setting theme to ${theme}`);
            set({ theme });
        }
        },
    }),
    {
        // --- Persistence Configuration ---
        name: 'theme-storage', // localStorage key
        storage: createJSONStorage(() => localStorage), // Use localStorage
        // Only the 'theme' property is persisted by default as it's the only top-level state.
        // onRehydrateStorage: ... (Optional: logging during rehydration)
    }
    )
);

