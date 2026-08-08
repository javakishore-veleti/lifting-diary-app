import { Show, SignUpButton } from "@clerk/nextjs";
import { Dumbbell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Placeholder rows only. This screen exists to prove the component foundation
// works -- it deliberately imports nothing from the data layer.
const PLACEHOLDER_SETS = [
  { id: 1, exercise: "Back Squat", reps: 5, weight: "100 kg" },
  { id: 2, exercise: "Back Squat", reps: 5, weight: "102.5 kg" },
  { id: 3, exercise: "Romanian Deadlift", reps: 8, weight: "80 kg" },
  { id: 4, exercise: "Pull-up", reps: 8, weight: "Bodyweight" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <Show when="signed-out">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Dumbbell className="size-5 text-primary" aria-hidden="true" />
              <CardTitle>Lifting Diary</CardTitle>
            </div>
            <CardDescription>
              Log every set, review your history, and see whether the numbers
              are actually going up.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your training log is private to your account. Create one to start
            recording sessions.
          </CardContent>
          <CardFooter>
            <SignUpButton>
              <Button className="w-full">Get started</Button>
            </SignUpButton>
          </CardFooter>
        </Card>
      </Show>

      <Show when="signed-in">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Recent sets</CardTitle>
            <CardDescription>
              Placeholder data. Nothing here is stored yet — recording sessions
              arrives with the training-log feature work.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>An example of a logged session.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercise</TableHead>
                  <TableHead className="text-right">Reps</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PLACEHOLDER_SETS.map((set) => (
                  <TableRow key={set.id}>
                    <TableCell className="font-medium">
                      {set.exercise}
                    </TableCell>
                    <TableCell className="text-right">{set.reps}</TableCell>
                    <TableCell className="text-right">{set.weight}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Show>
    </main>
  );
}
