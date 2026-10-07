// components/team-card-skeleton.tsx
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamCardSkeleton() {
  return (
    <Card className="max-w-sm w-full mx-auto">
      {/* Header Section */}
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            {/* Team name skeleton */}
            <Skeleton className="h-6 w-32" />
            {/* Team number badge skeleton */}
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>

        {/* Location skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-6 pb-4">
        {/* Image skeleton */}
        <div className="relative overflow-hidden rounded-xl bg-muted/50">
          <Skeleton className="h-48 w-full" />
        </div>

        {/* Stats skeleton */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex-col gap-3 px-6 pt-0 pb-6">
        {/* Button skeletons */}
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </CardFooter>
    </Card>
  );
}
