import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "schema.graphql",
  documents: [ "src/**/*.{ts,tsx}", "!src/gql/**/*" ],
  generates: {
    "src/gql/": {
      preset: "client",
      config: { enumsAsTypes: true, scalars: { ISO8601DateTime: "string" } },
      presetConfig: { fragmentMasking: false }
    }
  }
};

export default config;
