// "use client";

// import ComponentCode from "@/components/Code";
// import {
//   Accordion,
//   AccordionContent,
//   AccordionItem,
//   AccordionTrigger,
// } from "@/components/ui/accordion";
// import { Switch } from "@/components/ui/switch";
// import { ScimUser } from "@/lib/scim/models/scimSchemas";
// import { useSession } from "next-auth/react";
// import { useCallback, useEffect, useState } from "react";
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { PopcornIcon, Terminal } from "lucide-react";
// import { Textarea } from "@/components/ui/textarea";
// import { Button } from "@/components/ui/button";
// export default function Interception() {
//   const { data: session } = useSession();
//   const [users, setUsers] = useState<ScimUser[]>([]);
//   const [error, setError] = useState<string | null>(null);
//   const [isUsersLoading, setIsUsersLoading] = useState(true);
//   const userId = session?.user?.id!;
//   const [totalUsers, setTotalUsers] = useState(0);
//   const [userPage, setUserPage] = useState(1);
//   const ITEMS_PER_PAGE = 100;

//   const getUserCacheKey = (page: number) => `scim_users_page_${page}`;
//   const getGroupCacheKey = (page: number) => `scim_groups_page_${page}`;

//   const fetchUsers = useCallback(
//     async (page = 1) => {
//       const cacheKey = getUserCacheKey(page);
//       const cachedData = sessionStorage.getItem(cacheKey);

//       if (cachedData) {
//         const usersData = JSON.parse(cachedData);
//         setUsers(usersData.Resources || []);
//         setTotalUsers(usersData.totalResults || 0);
//         setUserPage(page);
//         setIsUsersLoading(false);
//         return;
//       }

//       setIsUsersLoading(true);
//       setError(null);
//       try {
//         const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
//         const usersRes = await fetch(
//           `/api/${userId}/scim/v2/Users?startIndex=${startIndex}&count=${ITEMS_PER_PAGE}`
//         );
//         if (!usersRes.ok)
//           throw new Error(`Failed to fetch users: ${usersRes.statusText}`);
//         const usersData = await usersRes.json();

//         sessionStorage.setItem(cacheKey, JSON.stringify(usersData));

//         setUsers(usersData.Resources || []);
//         setTotalUsers(usersData.totalResults || 0);
//         setUserPage(page);
//       } catch (e: any) {
//         setError(e.message);
//       } finally {
//         setIsUsersLoading(false);
//       }
//     },
//     [userId]
//   );

//   useEffect(() => {
//     const fetchData = async () => {
//       const startIndex = 1,
//         ITEMS_PER_PAGE = 0;
//       const userRes = await fetch(
//         `/api/${userId}/scim/v2/Users?startIndex=${startIndex}&count=${ITEMS_PER_PAGE}`
//       );
//       const userData = await userRes.json();
//       setTotalUsers(userData.totalResults);
//     };
//     fetchData();
//   }, [userId]);
//   return (
//     <div className="w-full max-w-4xl mx-auto p-4">
//       <h1 className="text-2xl font-bold mb-4">SCIM Users</h1>
//       <Alert className="flex items-center">
//         <PopcornIcon />
//         <AlertTitle>
//           You have a total of{" "}
//           <strong className="text-blue-500">{totalUsers}</strong> users. Would
//           you like to intercept the API calls to the Users endpoint?
//         </AlertTitle>
//         <Switch className="ml-auto" />
//       </Alert>
//       {totalUsers && <UserCard totalUsers={totalUsers} userId={userId} />}
//     </div>
//   );
// }

// const UserCardItem = ({ apiUrl }: { apiUrl: string }) => {
//   const [isSwitchActive, setIsSwitchActive] = useState(false);
//   const [curResponse, setCurResponse] = useState();

//   useEffect(() => {
//     const fetchData = async () => {
//       const res = await fetch(apiUrl);
//       const data = await res.json();
//       setCurResponse(data);
//     };
//     fetchData();
//   }, [apiUrl]);

//   return (
//     <AccordionItem value={apiUrl}>
//       <AccordionTrigger>
//         <div className="flex items-center">{apiUrl}</div>
//       </AccordionTrigger>
//       <AccordionContent className="flex items-center space-x-4">
//         <div className="flex flex-col w-full">
//           <div className="flex items-center mb-4">
//             <p className="text-l font-semibold">Current Response</p>
//             <Switch
//               onCheckedChange={setIsSwitchActive}
//               checked={isSwitchActive}
//               className="ml-auto"
//             />
//           </div>
//           {!isSwitchActive && (
//             <div className="max-w-200 max-h-250 overflow-auto">
//               <ComponentCode code={JSON.stringify(curResponse, null, 2)} />
//             </div>
//           )}

//           <div className="flex-grow mt-4">
//             {isSwitchActive && (
//               <>
//                 <Textarea placeholder="Paste your response" />
//                 <Button className="mt-4">Save</Button>
//               </>
//             )}
//           </div>
//         </div>
//       </AccordionContent>
//     </AccordionItem>
//   );
// };

// const UserCard = ({
//   totalUsers,
//   userId,
// }: {
//   totalUsers: number;
//   userId: string;
// }) => {
//   const cards = [];

//   for (let i = 0; i < totalUsers; i += 100) {
//     let apiUrl = `/api/${userId}/scim/v2/Users?startIndex=${i + 1}&count=100`;
//     cards.push(<UserCardItem key={i} apiUrl={apiUrl} />);
//   }

//   return (
//     <Accordion type="single" collapsible className="w-full">
//       {cards}
//     </Accordion>
//   );
// };
