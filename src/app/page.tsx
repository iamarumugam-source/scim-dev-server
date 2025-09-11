"use client";

import { useEffect, useState, FC } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScimUser, ScimGroup } from "@/lib/scim/models/scimSchemas";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";

// Helper component for loading state
const LoadingSpinner: FC = () => (
  <div className="flex justify-center items-center p-8">
    <svg
      className="animate-spin -ml-1 mr-3 h-10 w-10 text-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  </div>
);

// Helper component for error state
const ErrorDisplay: FC<{ message: string }> = ({ message }) => (
  <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-center">
    <p>
      <strong>Error:</strong> {message}
    </p>
  </div>
);

export default function ScimDashboard() {
  const [users, setUsers] = useState<ScimUser[]>([]);
  const [groups, setGroups] = useState<ScimGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const usersRes = await fetch("/api/scim/v2/Users");
      if (!usersRes.ok)
        throw new Error(`Failed to fetch users: ${usersRes.statusText}`);
      const usersData = await usersRes.json();
      setUsers(usersData.Resources || []);

      const groupsRes = await fetch("/api/scim/v2/Groups");
      if (!groupsRes.ok)
        throw new Error(`Failed to fetch groups: ${groupsRes.statusText}`);
      const groupsData = await groupsRes.json();
      setGroups(groupsData.Resources || []);
    } catch (e: any) {
      setError(e.message);
      toast.error(`Failed to fetch data: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateData = async () => {
    setIsGenerating(true);
    toast.info("Generating new sample data...");
    try {
      const res = await fetch("/api/scim/v2/generate", { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "An unknown error occurred.");
      }
      toast.success(
        "New data generated successfully! Fetching updated lists..."
      );
      await fetchData(); // Refresh data after generation
    } catch (e: any) {
      toast.error(`Error generating data: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }
    if (error) {
      return <ErrorDisplay message={error} />;
    }
    return (
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="cursor-pointer">
            Users
          </TabsTrigger>
          <TabsTrigger value="groups" className="cursor-pointer">
            Groups
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                A list of all users in the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.userName}
                        </TableCell>
                        <TableCell>{user.name?.formatted}</TableCell>
                        <TableCell>
                          {user.emails?.find((e) => e.primary)?.value}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.active ? "default" : "destructive"}
                          >
                            {user.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="groups">
          <Card>
            <CardHeader>
              <CardTitle>Groups</CardTitle>
              <CardDescription>
                A list of all groups and their members.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <Card key={group.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {group.displayName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <h4 className="font-semibold mb-2">
                        Members ({group.members?.length || 0})
                      </h4>
                      {group.members && group.members.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Username</TableHead>
                              <TableHead>User ID</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.members.map((member) => (
                              <TableRow key={member.value}>
                                <TableCell>{member.display}</TableCell>
                                <TableCell className="text-gray-500">
                                  {member.value}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-gray-500">
                          No members in this group.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No groups found.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <Toaster richColors />
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold">SCIM Administration</h1>
            <p className="text-muted-foreground">
              Manage your users and groups.
            </p>
          </div>
          <Button onClick={handleGenerateData} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate New Data"}
          </Button>
        </div>
        {renderContent()}
      </div>
    </main>
  );
}
