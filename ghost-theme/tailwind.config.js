/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: [
        "./*.hbs",
        "./partials/**/*.hbs",
        "./assets/js/**/*.js"
    ],
    theme: {
        extend: {
            colors: {
                bg: "var(--color-bg)",
                surface: "var(--color-surface)",
                "surface-2": "var(--surface2)",
                "surface-3": "var(--surface3)",
                "surface-hover": "var(--surface-hover)",
                text: "var(--color-text)",
                muted: "var(--color-muted)",
                primary: "var(--color-primary)",
                "primary-hover": "var(--accent-hover)",
                border: "var(--color-border)",
                success: "var(--color-success)",
                danger: "var(--color-danger)",
                warning: "var(--warning)"
            },
            fontFamily: {
                sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
                heading: ["var(--font-heading)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
                mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
            },
            maxWidth: {
                container: "1280px"
            }
        }
    },
    plugins: []
};
