import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Stand-in for admin sections that haven't been built yet. Each one names the
// task in the team task plan that replaces it. Delete when the last is built.
export function SectionPlaceholder({
  title,
  task,
  description,
}: {
  title: string;
  task: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold text-primary md:text-3xl">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming in {task}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Built by Tayo on top of Henry&apos;s server actions in <code>lib/admin</code>.
        </CardContent>
      </Card>
    </div>
  );
}
