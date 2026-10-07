import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { TeamWithImages } from "@/lib/types";
import TeamCarousel from "./image-carousel";
import { ExternalLink, MapPin, Calendar, Users, ImageIcon } from "lucide-react";

interface TeamCardProps {
  team: TeamWithImages;
}

export function TeamCard({ team }: TeamCardProps) {
  return (
    <Card className="max-w-sm w-full mx-auto">
      <div className="relative">
        <CardHeader className="relative space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <CardTitle className="text-xl font-bold">
                {team.nickname}
              </CardTitle>
              <Badge
                variant="secondary"
                className="w-fit bg-primary/10 text-primary border-primary/20"
              >
                Team {team.team_number}
              </Badge>
            </div>
          </div>

          <CardDescription className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="text-sm">
              {team.city}, {team.state_prov}
            </span>
          </CardDescription>
        </CardHeader>
      </div>

      <CardContent className="flex-1 px-6 pb-4">
        {/* Enhanced Image Section */}
        <div className="relative overflow-hidden rounded-xl bg-muted/50">
          {team.images.length > 0 ? (
            <TeamCarousel images={team.images} />
          ) : (
            <div className="relative h-48 w-full group/image">
              <div className="relative h-full w-full">
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-background/75">
                  <ImageIcon className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-sm font-medium">
                    No robot image available
                  </p>
                  <p className="text-xs">Team {team.team_number}</p>
                  {/* {team.yearLabel && <p className="text-xs mt-1">{team.yearLabel}</p>} */}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats or additional info could go here */}
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>FRC Team</span>
          </div>
          {team.rookie_year && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Est. {team.rookie_year}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex-col gap-3 px-4 pb-4">
        <Button asChild className="w-full group/button">
          <Link
            href={"/dashboard/team/" + String(team.team_number)}
            className="w-full"
            target="_blank"
          >
            <Users className="h-4 w-4 mr-2 transition-transform " />
            View Scouting Data
          </Link>
        </Button>

        {team.website ? (
          <Button asChild variant="outline" className="w-full group/website">
            <Link href={team.website} className="w-full" target="_blank">
              <ExternalLink className="h-4 w-4 mr-2 transition-transform " />
              Team Website
            </Link>
          </Button>
        ) : (
          <Button variant="outline" disabled className="w-full opacity-50">
            <ExternalLink className="h-4 w-4 mr-2" />
            No Website
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
