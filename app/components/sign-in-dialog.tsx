import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SignInForm } from "./sign-in-form";
import { getSession } from "@/app/utils/server/helpers";

export async function SignInDialog() {
  const session = await getSession();

  if (!session) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Sign in</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
          </DialogHeader>
          <SignInForm />
          {/* <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter> */}
        </DialogContent>
      </Dialog>
    );
  }
}
