import type { ComponentType, ReactNode } from "react";

type AnyProps = Record<string, unknown>;

/**
 * A provider entry for {@link Providers}.
 *
 * This is intentionally "erased" (non-generic) so you can compose a heterogeneous list of
 * providers (each with different props) in one array.
 *
 * Use {@link provider} to create a `ProviderSpec` with correct prop inference.
 */
export type ProviderSpec = readonly [Provider: ComponentType<unknown>, props: AnyProps];

type RequiredKeys<T> = {
  // biome-ignore lint/complexity/noBannedTypes: Intentional optional-key detection pattern.
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

type ProviderInputProps<TProps extends AnyProps> = Omit<TProps, "children">;

type ProviderArgProps<TProps extends AnyProps> = keyof ProviderInputProps<TProps> extends never
  ? Record<string, never>
  : ProviderInputProps<TProps>;

type ProviderPropsArg<TProps extends AnyProps> =
  RequiredKeys<ProviderInputProps<TProps>> extends never
    ? [props?: ProviderArgProps<TProps>]
    : [props: ProviderInputProps<TProps>];

/**
 * Create a typed `ProviderSpec` tuple with prop inference and required-prop enforcement.
 *
 * - If a provider has required props (excluding `children`), the props argument is required.
 * - If a provider has no props (excluding `children`), the props argument is optional and
 *   rejects extra keys.
 *
 * @param Provider - The React component to use as a provider.
 * @param args - Props to pass to the provider (excluding `children`).
 * @returns A `ProviderSpec` tuple.
 *
 * @example
 * ```tsx
 * import { provider, Providers } from "xtandard/react";
 *
 * // Provider with required props
 * provider(ThemeProvider, { theme: "dark" })
 *
 * // Provider with no props (optional)
 * provider(PermissionsProvider)
 * ```
 */
export const provider = <TProps extends AnyProps>(
  Provider: ComponentType<TProps>,
  ...args: ProviderPropsArg<TProps>
): ProviderSpec => {
  const props = (args[0] ?? {}) as AnyProps;
  return [Provider as ComponentType<unknown>, props] as const;
};

/**
 * Props for the {@link Providers} component.
 */
export type ProvidersProps = {
  /** List of providers (outer → inner), created with {@link provider}. */
  providers: readonly ProviderSpec[];
  children?: ReactNode;
};

const getProviderKey = (providerComponent: unknown, index: number): string => {
  const providerName =
    (providerComponent as { displayName?: string }).displayName ??
    (providerComponent as { name?: string }).name ??
    "Provider";
  return `${providerName}:${index}`;
};

function ProviderComponent({
  Provider,
  props,
  children,
}: {
  Provider: ComponentType<unknown>;
  props: AnyProps;
  children: ReactNode;
}): ReactNode {
  const Component = Provider as ComponentType<AnyProps & { children?: ReactNode }>;
  return <Component {...props}>{children}</Component>;
}

/**
 * Compose multiple React providers without deeply nesting JSX.
 * Eliminates "provider hell" by flattening the tree into an array.
 *
 * @example
 * ```tsx
 * import { Providers, provider } from "xtandard/react";
 *
 * <Providers
 *   providers={[
 *     provider(QueryClientProvider, { client: queryClient }),
 *     provider(ThemeProvider, { theme: "dark" }),
 *     provider(AuthProvider),
 *   ]}
 * >
 *   <App />
 * </Providers>
 * ```
 */
export const Providers = ({ providers, children }: ProvidersProps): ReactNode =>
  providers.reduceRight<ReactNode>(
    (acc, [Provider, props], index) => (
      <ProviderComponent key={getProviderKey(Provider, index)} Provider={Provider} props={props}>
        {acc}
      </ProviderComponent>
    ),
    children ?? null,
  );
