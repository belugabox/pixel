// https://vitejs.dev/config
export default async () => {
  const react = (await import("@vitejs/plugin-react")).default;
  return {
    plugins: [react()],
  };
};
