export const unstable_cache = fn => fn;
export const revalidateTag = () => {
  globalThis.__epRouteTest.invalidations++;
};
