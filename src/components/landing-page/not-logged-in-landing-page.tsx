"use client";

import { Button } from "@/components/ui/button";
import {
  UserPlus,
  ArrowRight,
  Hammer,
  Zap,
  BarChart3,
  ChevronDown,
  Target,
  Users,
  ShieldCheck,
  Trophy,
  Heart,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import {
  APP_LOGO,
  APP_LOGO_DARK,
  APP_NAME,
  ORGANIZATION_NAME,
  ORGANIZATION_URL,
} from "@/lib/app-config";

export function NotLoggedInLandingPage() {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const missionHighlights = [
    {
      title: "Purpose-built workflows",
      description:
        "Forms, analytics, and exports made for the chaos of competition.",
      icon: Target,
    },
    {
      title: "Reliable everywhere",
      description:
        "Offline sync keeps scouts productive from the stands to the pits.",
      icon: ShieldCheck,
    },
    {
      title: "Decisions with context",
      description:
        "Visual insights explain the story behind every robot's performance arc.",
      icon: BarChart3,
    },
  ];

  const featureCards = [
    {
      title: "Scheduling",
      description: "Collect anywhere, sync later",
      icon: Calendar,
      targetId: "scheduling",
    },
    {
      title: "Pit Scouting",
      description: "Robot capabilities & build notes",
      icon: Hammer,
      targetId: "pit-scouting",
    },
    {
      title: "Match Scouting",
      description: "Live drive-team intelligence",
      icon: Zap,
      targetId: "match-scouting",
    },
    {
      title: "Analytics",
      description: "Alliance-ready reporting",
      icon: BarChart3,
      targetId: "analytics",
    },
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setHasScrolled(true);
      } else {
        setHasScrolled(false);
      }
    };

    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true });

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Decorative Blurred Blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] bg-primary/15 rounded-full blur-3xl opacity-25 pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-[350px] h-[350px] bg-primary/20 rounded-full blur-3xl opacity-25 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <Image
                src={isDark ? APP_LOGO_DARK : APP_LOGO}
                alt={`${APP_NAME} logo`}
                width={40}
                height={40}
                className="rounded"
              />
            </div>
            <span className="font-bold text-lg">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/signup">
              <Button
                variant="outline"
                size="lg"
                className="inline-flex h-11 gap-1"
              >
                Sign up
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="default"
                size="lg"
                className="inline-flex h-11 gap-1"
              >
                Log in
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 w-full max-h-[70vh] sm:max-h-[80vh] flex items-center py-2 sm:py-12">
        <Image
          src="/assets/HeroSwapped.png"
          alt=""
          fill
          priority
          className="object-cover object-left sm:object-center -z-5"
          sizes="100vw"
        />
        <div className="absolute inset-0 max-lg:bg-black/50 lg:bg-linear-to-r lg:from-black/0 lg:to-black/60" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid gap-12 lg:grid-cols-[1fr_600px] items-center">
            <div />
            <div className="mx-4 sm:mx-0 space-y-8 text-center lg:text-right">
              <div className="space-y-3">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl text-white font-bold leading-tight">
                  A Modern Scouting Solution for FIRST.
                </h1>
                <p className="text-lg sm:text-xl text-white max-w-2xl">
                  One platform for scouting, performance metrics, and alliance
                  preparation.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-end items-center sm:items-start">
                <Link href="/signup">
                  <Button size="lg" className="h-11 gap-2 text-lg">
                    <UserPlus className="h-10 w-10" />
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div
            className={`flex justify-center mt-20 sm:mt-50 animate-bounce motion-reduce:animate-none transition-opacity duration-300 ${hasScrolled ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          >
            <div className="text-center">
              <p className="text-sm text-white mb-2">Why choose Athena?</p>
              <ChevronDown className="h-6 w-6 text-primary mx-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section
        id="mission"
        className="relative z-10 w-full py-16 sm:py-20 bg-primary/5"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Stay on track from anywhere.
            </h2>
            <p className="text-lg text-muted-foreground">
              Athena connects every match entry, every pit entry, and every
              strategy meeting so your team can plan with certainty.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-12">
            {missionHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-primary/15 bg-background/80 p-6 space-y-3"
                >
                  <div className="flex justify-between">
                    <h3 className="text-xl font-semibold">{item.title}</h3>
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="relative z-10 w-full py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Tools to match your workflow.
            </h2>
            <p className="text-lg text-muted-foreground">
              Learn more about our features that help you plan your schedule,
              scout in the pits and during matches, and analyze your results.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.title}
                  onClick={() =>
                    document
                      .getElementById(card.targetId)
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="group text-left"
                >
                  <div className="h-full rounded-2xl border border-primary/15 bg-background/80 hover:border-primary/40 transition-colors p-6 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between">
                      <h3 className="font-semibold text-xl mb-2">
                        {card.title}
                      </h3>
                      <Icon className="h-7 w-7 text-primary mb-4" />
                    </div>
                    <div className="flex items-center text-sm font-medium text-primary gap-2 -mt-1">
                      Explore
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section 1 - Scheduling */}
      <section
        id="scheduling"
        className="relative z-10 w-full py-12 sm:py-16 bg-primary/5"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="aspect-square rounded-lg bg-background flex items-center justify-center overflow-hidden">
                <Image
                  src="/assets/Scouting2.JPG"
                  width={600}
                  height={600}
                  alt="Student scouting using green scouting tablet."
                />
              </div>
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Scheduling
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Build reliable scouting rotations, assign each seat, and keep
                every match covered. Scouts can see what is next without
                searching through a separate schedule.
              </p>
              <Link href="/login">
                <Button variant="outline" size="lg" className="h-11 gap-2">
                  GET STARTED <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section 2 - Pit Scouting */}
      <section
        id="pit-scouting"
        className="relative z-10 w-full py-12 sm:py-16"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Pit Scouting
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Collect detailed robot capabilities and team data directly from
                the pits. Comprehensive scouting tools designed to capture
                everything you need to know about each team's robot and
                strategy.
              </p>
              <Link href="/login">
                <Button variant="outline" size="lg" className="h-11 gap-2">
                  GET STARTED <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="order-1 lg:order-2 relative">
              <div className="aspect-square rounded-lg bg-primary/5 flex items-center justify-center overflow-hidden">
                <Image
                  src="/assets/PitScouting.JPG"
                  width={600}
                  height={600}
                  alt="Students from different robotics team looking together at green scouting tablet."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section 3 - Match Scouting */}
      <section
        id="match-scouting"
        className="relative z-10 w-full py-12 sm:py-16 bg-primary/5"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="aspect-square rounded-lg bg-background flex items-center justify-center overflow-hidden">
                <Image
                  src="/assets/Tablets.JPG"
                  width={600}
                  height={600}
                  alt="Students scouting using green scouting tablets."
                />
              </div>
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Match Scouting
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Real-time match data collection during competitions. Capture
                live performance metrics, game events, and team actions with our
                fast and intuitive scouting interface designed for the heat of
                competition.
              </p>
              <Link href="/login">
                <Button variant="outline" size="lg" className="h-11 gap-2">
                  GET STARTED <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section 4 - Analytics */}
      <section id="analytics" className="relative z-10 w-full py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">Analytics</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Transform raw scouting data into actionable insights.
                Performance data and trends help your team make informed
                decisions about team rankings, alliance selection, and match
                strategy.
              </p>
              <Link href="/login">
                <Button variant="outline" size="lg" className="h-11 gap-2">
                  GET STARTED <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="order-1 lg:order-2 relative">
              <div className="aspect-square rounded-lg bg-primary/5 flex items-center justify-center overflow-hidden">
                <Image
                  src="/assets/Strat.JPG"
                  width={600}
                  height={600}
                  alt="Students looking over at a clipboard while strategizing."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About the platform */}
      <section
        id="about"
        className="relative z-10 w-full py-12 sm:py-16 bg-background/50"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Built for the full competition workflow
          </h2>
          <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
            {APP_NAME} keeps collection, coordination, and analysis in one
            configurable workspace. Adapt the app to your organization while
            giving scouts and strategy leads a shared source of truth.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 justify-center max-w-xl mx-auto">
            <div className="rounded-2xl border border-primary/20 bg-background/80 p-4 flex flex-col items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold text-center">Student-led</div>
                <div className="text-sm text-muted-foreground">
                  Design, build, and ship by students.
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-background/80 p-4 flex flex-col items-center gap-3">
              <Trophy className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold text-center">
                  Competition Proven
                </div>
                <div className="text-sm text-muted-foreground">
                  Field-tested at regionals and beyond.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 w-full mt-auto border-t bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-muted-foreground">
            <span>
              Made with
              <Heart className="inline-block h-4 w-4 mx-1 text-green-500" />
              for FIRST teams
              {ORGANIZATION_NAME && (
                <>
                  {" · "}
                  {ORGANIZATION_URL ? (
                    <a
                      href={ORGANIZATION_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-primary transition-colors"
                    >
                      {ORGANIZATION_NAME}
                    </a>
                  ) : (
                    ORGANIZATION_NAME
                  )}
                </>
              )}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
