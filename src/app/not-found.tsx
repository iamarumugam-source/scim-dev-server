"use client";

import Link from "next/link";
import { Ghost } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default function NotFound() {
  return (
    <div className="flex min-h-svh">
      <Empty className="border-none">
        <EmptyHeader>
          <div className="flex size-24 items-center justify-center rounded-2xl bg-primary/10">
            <motion.div
              animate={{ x: [-8, 8] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
            >
              <Ghost className="size-12 text-primary" />
            </motion.div>
          </div>
          <p className="text-5xl font-bold tracking-tight tabular-nums">404</p>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
