"use client";

import { ExternalLink, User, Shuffle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { USER_PROPS, FAKER_GENERATORS } from "./constants";

const FAKER_BY_CATEGORY = FAKER_GENERATORS.reduce<Record<string, typeof FAKER_GENERATORS>>(
  (acc, g) => { (acc[g.category] ??= []).push(g); return acc; },
  {},
);

function Token({ value }: { value: string }) {
  return (
    <code className="text-[10px] font-mono px-1 py-0.5 rounded bg-primary/5 text-primary">
      {`{{${value}}}`}
    </code>
  );
}

export function ReferenceCard() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold">Template Reference</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use these expressions inside any field value — including inside Raw JSON templates.
          </p>
        </div>

        <Separator />

        <Accordion type="multiple" className="space-y-0">

          {/* User Properties */}
          <AccordionItem value="user-props" className="border-b-0">
            <AccordionTrigger className="py-3 text-xs font-semibold hover:no-underline gap-2 [&>svg]:ml-auto">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                User Properties
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-5">
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wide w-1/3">Expression</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wide">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {USER_PROPS.map((p) => (
                      <TableRow key={p.value} className="hover:bg-muted/30">
                        <TableCell className="py-2.5">
                          <Token value={`user.${p.value}`} />
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">{p.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Any dot-path into the SCIM user object works — e.g.{" "}
                <code className="font-mono">{"{{user.emails.1.value}}"}</code> for the second email.
              </p>
            </AccordionContent>
          </AccordionItem>

          <Separator />

          {/* Faker Generators */}
          <AccordionItem value="faker" className="border-b-0">
            <AccordionTrigger className="py-3 text-xs font-semibold hover:no-underline gap-2 [&>svg]:ml-auto">
              <div className="flex items-center gap-2">
                <Shuffle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                Faker Generators
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-5">
              <div className="space-y-4">
                {Object.entries(FAKER_BY_CATEGORY).map(([category, generators]) => (
                  <div key={category}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      {category}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {generators.map((g) => (
                        <div key={g.value} className="flex items-center gap-1">
                          <Token value={`faker.${g.value}`} />
                          <span className="text-[10px] text-muted-foreground">{g.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <a
                  href="https://fakerjs.dev/api/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                >
                  <ExternalLink className="h-3 w-3" />
                  Full Faker.js API reference
                </a>
                <span className="text-[10px] text-muted-foreground">— any method listed there works as a generator</span>
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>

        {/* How it works */}
        <div className="rounded-md bg-muted/30 border border-border/60 p-3 space-y-1.5 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide">How it works</p>
          <ul className="space-y-1 ml-3 list-disc">
            <li><strong className="text-foreground">User Property</strong> — reads the value from the SCIM user at request time</li>
            <li><strong className="text-foreground">Random (Faker)</strong> — generates a fresh value on every API call</li>
            <li><strong className="text-foreground">Static</strong> — always returns the exact value you configure</li>
            <li><strong className="text-foreground">Raw JSON</strong> — any structure; embed <code className="font-mono">{"{{...}}"}</code> expressions inside string values</li>
            <li>Extensions are cached for 30 s and applied as an interceptor — stored user data is never modified</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
