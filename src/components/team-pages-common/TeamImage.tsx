"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeamImageProps {
  teamNumber: string;
  yearLabel?: string;
  competitionType?: "FRC" | "FTC";
}

export function TeamImage({
  teamNumber,
  yearLabel,
  competitionType = "FRC",
}: TeamImageProps) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    async function fetchTeamImages() {
      try {
        setLoading(true);
        setError(null);

        // Fetch team images from unified API
        const response = await fetch(
          `/api/teams/${teamNumber}/media?competitionType=${competitionType}`,
        );
        if (response.ok) {
          const imageUrls = await response.json();
          setImages(imageUrls);
          setCurrentImageIndex(0);
        } else {
          setImages([]);
        }
      } catch (err) {
        console.error("Error fetching team images:", err);
        setError("Failed to load images");
        setImages([]);
      } finally {
        setLoading(false);
      }
    }

    if (teamNumber) {
      fetchTeamImages();
    }
  }, [teamNumber, competitionType]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="relative aspect-video w-full bg-muted/30 group rounded-lg overflow-hidden border">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <ImageIcon className="h-16 w-16 mb-4 opacity-50 animate-pulse" />
          <p className="text-sm font-medium">Loading images...</p>
          <p className="text-xs">Team {teamNumber}</p>
        </div>
      ) : images.length > 0 ? (
        <>
          <div className="relative h-full w-full group/image">
            <Image
              src={images[currentImageIndex]}
              alt={`Team ${teamNumber}'s robot image ${currentImageIndex + 1}`}
              fill
              className="object-cover"
              loading="lazy"
              sizes="(max-width: 640px) 100vw,
                      (max-width: 1024px) 50vw,
                      33vw"
            />

            {yearLabel && (
              <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                {yearLabel}
              </div>
            )}

            {images.length > 1 && (
              <>
                {/* Navigation buttons */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/70 border-white/20 text-white hover:bg-black/70 size-11"
                  type="button"
                  aria-label="Previous robot image"
                  onClick={prevImage}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/70 border-white/20 text-white hover:bg-black/70 size-11"
                  type="button"
                  aria-label="Next robot image"
                  onClick={nextImage}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Image counter */}
                <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                  {currentImageIndex + 1} / {images.length}
                </div>

                {/* Image indicators */}
                <div className="absolute bottom-0 right-0 left-0 flex justify-end overflow-x-auto px-2">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className="flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2"
                      aria-pressed={index === currentImageIndex}
                      onClick={() => setCurrentImageIndex(index)}
                      aria-label={`View image ${index + 1}`}
                    >
                      <span className={`size-2 rounded-full ring-1 ring-black/50 ${index === currentImageIndex ? "bg-white" : "bg-white/50"}`} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="relative h-full w-full">
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-background/80">
            <ImageIcon className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-sm font-medium">{error ?? "No robot image available"}</p>
            <p className="text-xs">Team {teamNumber}</p>
            {yearLabel && <p className="text-xs mt-1">{yearLabel}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamImage;
