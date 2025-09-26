"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { ScimUser } from "@/lib/scim/models/scimSchemas";
import { useSession } from "next-auth/react";
import { getColumns } from "./columns";
import { DataTable } from "./data-table";
import { PaginationState } from "@tanstack/react-table";
import { LoadingSpinner } from "@/components/helper-components";
import { toast } from "sonner";

export default function UsersPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [users, setUsers] = useState<ScimUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
  });

  const fetchUsers = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const startIndex = pagination.pageIndex * pagination.pageSize + 1;
      const count = pagination.pageSize;

      const usersRes = await fetch(
        `/api/${userId}/scim/v2/Users?startIndex=${startIndex}&count=${count}`
      );
      if (!usersRes.ok) {
        throw new Error(`Failed to fetch users: ${usersRes.statusText}`);
      }
      const usersData = await usersRes.json();
      setUsers(usersData.Resources || []);
      setTotalUsers(usersData.totalResults || 0);
    } catch (e: any) {
      toast.error(`Failed to fetch users: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [userId, pagination]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDeleteUser = async (userToDeleteId: string) => {
    if (!userId) return;

    try {
      const res = await fetch(
        `/api/${userId}/scim/v2/Users/${userToDeleteId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.detail || res.statusText;
        throw new Error(errorMessage);
      }

      toast.success("User successfully deleted.");
      fetchUsers();
    } catch (e: any) {
      toast.error(`Failed to delete user: ${e.message}`);
    }
  };

  const pageCount = useMemo(() => {
    return Math.ceil(totalUsers / pagination.pageSize);
  }, [totalUsers, pagination.pageSize]);
  const columns = useMemo(
    () => getColumns({ handleDeleteUser }),
    [handleDeleteUser]
  );
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns}
          data={users}
          pageCount={pageCount}
          pagination={pagination}
          setPagination={setPagination}
        />
      )}
    </div>
  );
}
