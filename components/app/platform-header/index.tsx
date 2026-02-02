import { PlatformHeaderButtons } from "./buttons";
import { PlatformHeaderTitle } from "./title";
import { PlatformHeaderDescription } from "./description";

export function PlatformHeader() {
  return (
    <div className="flex flex-col items-stretch space-y-1 pb-5">
      <div className="flex items-center justify-between">
        <PlatformHeaderTitle />
        <PlatformHeaderButtons />
      </div>

      <PlatformHeaderDescription className="pt-2" />
    </div>
  );
}
