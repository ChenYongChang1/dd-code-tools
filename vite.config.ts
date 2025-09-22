import { ConfigEnv, defineConfig } from "vite";
export default ({ mode, command }: ConfigEnv) => {
  return {
    build: {
      lib: [
        {
          entry: "./src/uni-tools/index.ts",
          name: "ddUniUtils",
          fileName: "ddUni",
          formats: ["esm", "cjs"],
        },
        {
          entry: "./src/vite-tools/index.ts",
          name: "ddCodeUtils",
          fileName: "ddVite",
          formats: ["esm", "cjs"],
        },
      ],
    },
  };
};
