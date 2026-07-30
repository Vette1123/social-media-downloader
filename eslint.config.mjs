import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// eslint-config-next 16 ships flat configs directly. The previous setup routed
// them through @eslint/eslintrc's FlatCompat, which now throws
// ("Converting circular structure to JSON") because it tries to validate a
// modern config against the legacy schema. Consuming the flat exports removes
// the shim entirely.
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'out/**',
      '.wrangler/**',
      '.worker-size-check/**',
      'node_modules/**',
      // Runtime stub for packages that cannot exist on workerd; it is
      // deliberately not part of the app's source graph.
      'cloudflare/stubs/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // The proxy routes drop a header by destructuring it into a discard
      // binding (`const { Range: _omit, ...rest } = headers`). Leading
      // underscore is the standard opt-out for a deliberately unused binding.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
]

export default eslintConfig
