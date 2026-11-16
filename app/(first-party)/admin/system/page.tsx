import { SearchIndex } from "./search-index";
import { ModerationCoverage } from "./moderation";
import { AuthStatus } from "./status";
import { ImageStorage } from "./images";
export default function SystemPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">System</h1>
      <AuthStatus />
      <ImageStorage />
      <ModerationCoverage />
      <SearchIndex />
    </main>
  );
}
