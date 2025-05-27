"use client";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteAdmin } from "@/hooks/use-delete-admin";
import { useDeleteAdminInvite } from "@/hooks/use-delete-admin-invite";
import { Admin } from "@/lib/typings";
import { capitalizeFirstLetter } from "@/lib/utils";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function AdminsTableRow({ admin }: { admin: Admin }) {
  const { session } = useAuth();

  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);

  const deleteAdmin = useDeleteAdmin();

  const deleteAdminInvite = useDeleteAdminInvite();

  const handleOnDelete = async (admin: Admin) => {
    if (admin.status === "invited" && admin.adminInviteId) {
      await deleteAdminInvite.mutateAsync({
        adminInviteId: admin.adminInviteId,
      });

      toast.success("Invitation successfully revoked", {
        position: "top-right",
      });
    }

    if (admin.status === "admin" && admin.userId) {
      await deleteAdmin.mutateAsync({ adminId: admin.userId });

      toast.success("Admin successfully removed", {
        position: "top-right",
      });
    }
  };

  return (
    <>
      <TableRow>
        <TableCell className="">{admin.email}</TableCell>
        <TableCell className="">
          {admin.status === "invited" ? "Invite pending" : "Active"}
        </TableCell>
        <TableCell className="text-right">
          {session?.user.id !== admin.userId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-destructive!"
                  onClick={() => setIsDeleteConfirmationOpen(true)}
                >
                  <Trash2Icon className="text-destructive! size-3.5!" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {admin.status === "invited"
                  ? "Revoke invitation"
                  : "Remove admin"}
              </TooltipContent>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>

      <AlertDialog open={isDeleteConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {admin.status === "invited"
                ? "Revoke invitation"
                : "Remove admin"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {admin.status === "invited"
                ? `Are you sure you want to revoke the admin invitation for ${admin.email} ?`
                : `Are you sure you want to remove admin privileges for ${admin.email}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setIsDeleteConfirmationOpen(false)}
              disabled={
                admin.status === "admin"
                  ? deleteAdmin.isPending
                  : deleteAdminInvite.isPending
              }
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleOnDelete(admin);
              }}
              disabled={
                admin.status === "admin"
                  ? deleteAdmin.isPending
                  : deleteAdminInvite.isPending
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
