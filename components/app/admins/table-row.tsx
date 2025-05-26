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

export function AdminsTableRow({ admin }: { admin: Admin }) {
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);

  const deleteAdmin = useDeleteAdmin();

  const deleteAdminInvite = useDeleteAdminInvite();

  const handleOnDelete = (admin: Admin) => {
    if (admin.status === "invited" && admin.adminInviteId) {
      deleteAdminInvite.mutate({ adminInviteId: admin.adminInviteId });
    }

    if (admin.status === "admin" && admin.userId) {
      deleteAdmin.mutate({ adminId: admin.userId });
    }
  };

  return (
    <>
      <TableRow>
        <TableCell className="">{admin.email}</TableCell>
        <TableCell className="">
          {capitalizeFirstLetter(admin.status)}
        </TableCell>
        <TableCell className="text-right">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="text-destructive!"
                onClick={() => setIsDeleteConfirmationOpen(true)}
              >
                <Trash2Icon className="text-destructive!" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {admin.status === "invited"
                ? "Remove invitation"
                : "Remove admin"}
            </TooltipContent>
          </Tooltip>
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
