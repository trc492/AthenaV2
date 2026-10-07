"use client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./ui/carousel";
import Image from "next/image";

export default function TeamCarousel({ images }: { images: string[] }) {
  return (
    <div className="relative group">
      <Carousel
        opts={{
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent>
          {images.map((url, index) => (
            <CarouselItem key={url}>
              <div className="relative h-48 w-full overflow-hidden rounded-lg group/image">
                <Image
                  src={url}
                  alt={`Robot Image ${index + 1}`}
                  fill
                  className="object-cover"
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw,
                        (max-width: 1024px) 50vw,
                        (max-width: 1280px) 33vw,
                        25vw"
                />
                {/* Image counter */}
                <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                  {index + 1} / {images.length}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Enhanced navigation buttons */}
        {images.length > 1 && <>
        <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10 size-11 bg-black/70 border-white/20 text-white hover:bg-black/70" />
        <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10 size-11 bg-black/70 border-white/20 text-white hover:bg-black/70" />

        </>}
      </Carousel>
    </div>
  );
}
