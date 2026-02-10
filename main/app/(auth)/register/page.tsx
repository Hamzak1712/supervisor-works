import { RegisterForm } from "@/components/auth/RegisterForm"

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-chart-2/5 blur-3xl" />
      </div>
      
      {/* Grid pattern overlay */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                            linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo and branding */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">SupervisorMatch</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI-Powered Academic Project Supervision System
          </p>
        </div>

        <RegisterForm />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By registering, you agree to our Terms of Service and Privacy Policy.
          <br />
          GDPR compliant. Your data is secure.
        </p>
      </div>
    </main>
  )
}
