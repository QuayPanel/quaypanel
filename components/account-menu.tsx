"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/src/auth/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountMenu({
  email,
  role,
  portal,
}: {
  email: string;
  role: string;
  portal: "admin" | "client" | "public";
}) {
  const router = useRouter();
  const isStaff = role === "ADMIN" || role === "STAFF";

  async function logout() {
    await authClient.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <span className="max-w-[200px] truncate">{email}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {portal === "admin" || portal === "public" ? (
          <DropdownMenuItem asChild>
            <Link href="/client">
              <LayoutDashboard className="h-4 w-4" />
              Client Dashboard
            </Link>
          </DropdownMenuItem>
        ) : null}
        {(portal === "client" || portal === "public") && isStaff ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard className="h-4 w-4" />
              Admin Panel
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/client/profile">
            <UserRound className="h-4 w-4" />
            Account Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
