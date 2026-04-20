"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Send, MessageSquare } from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { currentStudent, currentSupervisor } from "@/lib/mock-data"

type ChatMessage = {
  id: string
  senderId: string
  receiverId: string
  body: string
  createdAt: string
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function MessagesPage() {
  const searchParams = useSearchParams()
  const otherUserId = searchParams.get("userId") || ""
  const otherUserName = searchParams.get("name") || "Conversation"

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [currentUserId, setCurrentUserId] = useState("")
  const [currentRole, setCurrentRole] = useState<"student" | "supervisor">(
    "student"
  )

  useEffect(() => {
    const userId = localStorage.getItem("userId") || ""
    const role = localStorage.getItem("role") || ""

    setCurrentUserId(userId)

    if (role === "SUPERVISOR") {
      setCurrentRole("supervisor")
    } else {
      setCurrentRole("student")
    }
  }, [])

  useEffect(() => {
    async function fetchMessages() {
      if (!otherUserId) {
        setLoading(false)
        return
      }

      try {
        setError("")
        const token = localStorage.getItem("token")

        const res = await fetch(`/api/messages?userId=${otherUserId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load messages")
        }

        setMessages(data.messages || [])
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load messages.")
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [otherUserId])

  const orderedMessages = useMemo(() => messages, [messages])

  async function sendMessage() {
    try {
      if (!newMessage.trim()) return

      setSending(true)
      setError("")

      const token = localStorage.getItem("token")

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiverId: otherUserId,
          body: newMessage,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to send message")
      }

      setMessages((prev) => [...prev, data.message])
      setNewMessage("")
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not send message.")
    } finally {
      setSending(false)
    }
  }

  const shellUser =
    currentRole === "supervisor" ? currentSupervisor : currentStudent

  return (
    <DashboardShell
      user={shellUser}
      role={currentRole}
      title="Messages"
    >
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">
              {error}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-4 w-4 text-primary" />
              {otherUserName}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">
                Loading messages...
              </div>
            ) : !otherUserId ? (
              <div className="text-sm text-muted-foreground">
                No conversation selected.
              </div>
            ) : orderedMessages.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No messages yet. Start the conversation.
              </div>
            ) : (
              <div className="space-y-3">
                {orderedMessages.map((message) => {
                  const mine = message.senderId === currentUserId

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        mine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-line">{message.body}</p>
                        <p
                          className={`mt-2 text-[10px] ${
                            mine
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatDateTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {otherUserId && (
              <div className="space-y-3 border-t pt-4">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Write your message..."
                  rows={4}
                />
                <Button onClick={sendMessage} disabled={sending}>
                  <Send className="mr-2 h-4 w-4" />
                  {sending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}