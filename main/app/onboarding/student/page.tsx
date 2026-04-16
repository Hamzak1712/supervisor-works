"use client"

import { useState } from "react"

const steps = [
  {
    id: 1,
    title: "Project Idea",
    question: "What do you want to do for your project?",
    placeholder: "For example: I want to build an AI-powered web app for supervisor matching.",
  },
  {
    id: 2,
    title: "Strengths",
    question: "What are your strengths?",
    placeholder: "For example: Java, React, problem solving, database design.",
  },
  {
    id: 3,
    title: "Weaknesses",
    question: "What are your weaknesses?",
    placeholder: "For example: UI design, time management, machine learning theory.",
  },
]

export default function StudentOnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState({
    projectIdea: "",
    strengths: "",
    weaknesses: "",
  })

  const step = steps[currentStep]

  const handleChange = (value: string) => {
    if (currentStep === 0) {
      setAnswers((prev) => ({ ...prev, projectIdea: value }))
    }
    if (currentStep === 1) {
      setAnswers((prev) => ({ ...prev, strengths: value }))
    }
    if (currentStep === 2) {
      setAnswers((prev) => ({ ...prev, weaknesses: value }))
    }
  }

  const getValue = () => {
    if (currentStep === 0) return answers.projectIdea
    if (currentStep === 1) return answers.strengths
    if (currentStep === 2) return answers.weaknesses
    return ""
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </p>
          <h1 className="text-2xl font-bold mt-2">{step.title}</h1>
          <p className="text-muted-foreground mt-2">{step.question}</p>
        </div>

        <textarea
          value={getValue()}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={step.placeholder}
          className="w-full min-h-[180px] rounded-xl border bg-background p-4 outline-none resize-none"
        />

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="rounded-xl border px-4 py-2 disabled:opacity-50"
          >
            Back
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="rounded-xl bg-primary px-4 py-2 text-primary-foreground"
            >
              Next
            </button>
          ) : (
            <button
              className="rounded-xl bg-primary px-4 py-2 text-primary-foreground"
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}