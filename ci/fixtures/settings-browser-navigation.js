export function useRouter() {
  return {
    refresh() {
      window.settingsFixture.refreshes++;
    },
  };
}
