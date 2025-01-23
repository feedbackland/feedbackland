import "@iframe-resizer/child";
import { getSession } from "@/lib/server/utils";
import { SignOutButton } from "@/components/app/sign-out/sign-out-button";
import { SignInDialog } from "@/components/app/sign-in/sign-in-dialog";
import { FancyCodeBlock } from "@/components/ui/fancy-code-block";
import { CodeBlock } from "@/components/ui/code-block";

export default async function RootPage() {
  const session = await getSession();

  const code = `
    const GroceryItem: React.FC<GroceryItemProps> = ({ item }) => {
      return (
        <div>
          <h2>{item.name}</h2>
          <p>Price: {item.price}</p>
          <p>Quantity: {item.quantity}</p>
        </div>
      );
    }
  `;

  return (
    <div className="flex flex-col space-y-5 max-w-[400px] w-full">
      <div>
        <FancyCodeBlock code={code} language="tsx" />
      </div>
      <div>
        <CodeBlock code={code} />
      </div>
      <div>{session ? <SignOutButton /> : <SignInDialog />}</div>
    </div>
  );
}
