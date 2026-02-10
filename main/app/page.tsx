import React from "react"
import Link from "next/link"
import { GraduationCap, Users, BarChart3, Shield, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <main className="relative min-h-screen">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -right-40 top-1/2 h-96 w-96 rounded-full bg-chart-2/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                            linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl font-bold">SupervisorMatch</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get Started</Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-16 text-center lg:px-12 lg:pt-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-1.5 text-sm backdrop-blur-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">AI-Powered Matching</span>
        </div>

        <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Find Your Ideal{" "}
          <span className="gradient-text">Academic Supervisor</span>{" "}
          with AI
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
          Intelligent matching system that connects students with supervisors
          based on research interests, expertise, and project requirements.
          Streamline your academic journey.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/register">
              Start Matching
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign In to Dashboard</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 lg:px-12">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything You Need
          </h2>
          <p className="mt-3 text-muted-foreground">
            A comprehensive platform for academic project supervision
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Sparkles className="h-6 w-6" />}
            title="AI-Powered Matching"
            description="Our intelligent algorithm analyzes your project, skills, and interests to find the perfect supervisor match."
          />
          <FeatureCard
            icon={<BarChart3 className="h-6 w-6" />}
            title="Adaptive Gantt Charts"
            description="Dynamic project timelines that automatically adjust when delays occur, keeping you on track."
          />
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title="Global Oversight"
            description="Supervisors can monitor all students at a glance with progress alerts and milestone tracking."
          />
          <FeatureCard
            icon={<Shield className="h-6 w-6" />}
            title="GDPR Compliant"
            description="Your data is protected with industry-standard encryption and privacy-first design principles."
          />
          <FeatureCard
            icon={<GraduationCap className="h-6 w-6" />}
            title="University Integration"
            description="Built around official university deadlines with locked critical path milestones."
          />
          <FeatureCard
            icon={<BarChart3 className="h-6 w-6" />}
            title="Admin Dashboard"
            description="Complete system oversight with user management, role assignment, and capacity controls."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 lg:px-12">
        <div className="rounded-2xl border border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm md:p-12">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Ready to Find Your Perfect Match?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Join hundreds of students and supervisors using SupervisorMatch
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">Create Account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Demo Login</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 px-6 py-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-semibold">SupervisorMatch</span>
          </div>
          <p className="text-sm text-muted-foreground">
            University Project Supervision System. GDPR Compliant.
          </p>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="group rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-card">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
