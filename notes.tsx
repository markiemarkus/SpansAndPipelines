import { useState, useRef, useEffect } from "react";

export default function AgentChat({ apiUrl = "http://localhost:8000/ask" }) {
  const [messages, setMessages] = useState([
    { role: "agent", text: "Ready. Ask me anything." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);
    setMessages(m => [...m, { role: "user", text: q }]);
    setStatus("agent is thinking…");

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const answer = data.answer ?? data.response ?? data.message ?? JSON.stringify(data);
      setMessages(m => [...m, { role: "agent", text: answer }]);
      setStatus("last response: " + new Date().toLocaleTimeString());
    } catch (e) {
      setMessages(m => [...m, { role: "agent", text: "Could not reach the backend.", error: true }]);
      setStatus("error: " + e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ fontFamily: "monospace", maxWidth: 680 }}>
      {/* messages, input bar, status — wire up to your styles */}
    </div>
  );
}
