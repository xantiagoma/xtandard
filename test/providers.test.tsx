/**
 * @vitest-environment jsdom
 */
import { describe, test, expect } from "vitest";
import React, { createContext, useContext, type ReactNode } from "react";
import { render } from "vitest-browser-react";
import { Providers, provider } from "../src/providers.tsx";

// Test contexts
const ThemeContext = createContext("light");
const AuthContext = createContext<string | null>(null);
const LocaleContext = createContext("en");

function ThemeProvider({ theme, children }: { theme: string; children?: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

function AuthProvider({ userId, children }: { userId: string; children?: ReactNode }) {
  return <AuthContext.Provider value={userId}>{children}</AuthContext.Provider>;
}

function LocaleProvider({ children }: { children?: ReactNode }) {
  return <LocaleContext.Provider value="es">{children}</LocaleContext.Provider>;
}

function TestConsumer() {
  const theme = useContext(ThemeContext);
  const auth = useContext(AuthContext);
  const locale = useContext(LocaleContext);
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="auth">{auth}</span>
      <span data-testid="locale">{locale}</span>
    </div>
  );
}

describe("provider()", () => {
  test("creates a ProviderSpec tuple", () => {
    const spec = provider(ThemeProvider, { theme: "dark" });
    expect(spec).toHaveLength(2);
    expect(spec[0]).toBe(ThemeProvider);
    expect(spec[1]).toEqual({ theme: "dark" });
  });

  test("works without props for no-prop providers", () => {
    const spec = provider(LocaleProvider);
    expect(spec).toHaveLength(2);
    expect(spec[0]).toBe(LocaleProvider);
    expect(spec[1]).toEqual({});
  });
});

describe("Providers", () => {
  test("composes multiple providers", async () => {
    const screen = await render(
      <Providers
        providers={[
          provider(ThemeProvider, { theme: "dark" }),
          provider(AuthProvider, { userId: "u_123" }),
          provider(LocaleProvider),
        ]}
      >
        <TestConsumer />
      </Providers>,
    );

    await expect.element(screen.getByTestId("theme")).toHaveTextContent("dark");
    await expect.element(screen.getByTestId("auth")).toHaveTextContent("u_123");
    await expect.element(screen.getByTestId("locale")).toHaveTextContent("es");
  });

  test("renders children without providers", async () => {
    const screen = await render(
      <Providers providers={[]}>
        <div data-testid="child">hello</div>
      </Providers>,
    );

    await expect.element(screen.getByTestId("child")).toHaveTextContent("hello");
  });

  test("renders null without children", async () => {
    const screen = await render(<Providers providers={[provider(LocaleProvider)]} />);

    expect(screen).toBeDefined();
  });

  test("outer providers wrap inner providers", async () => {
    // ThemeProvider is outer, AuthProvider is inner
    // Both should be accessible from the child
    const screen = await render(
      <Providers
        providers={[
          provider(ThemeProvider, { theme: "blue" }),
          provider(AuthProvider, { userId: "admin" }),
        ]}
      >
        <TestConsumer />
      </Providers>,
    );

    await expect.element(screen.getByTestId("theme")).toHaveTextContent("blue");
    await expect.element(screen.getByTestId("auth")).toHaveTextContent("admin");
  });
});
