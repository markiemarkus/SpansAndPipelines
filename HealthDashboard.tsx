import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Send,
  MessageCircle,
  Activity,
  X,
  Sparkles,
} from "lucide-react";

/* =========================================================================
   TYPES
   ========================================================================= */

type Status = "healthy" | "degraded" | "critical" | "unknown";

interface Check {
  id: string;
  name: string;
  category: string;
  status: Status;
  latencyMs: number;
  uptime: number; // percentage, 0-100
  region: string;
  minutesAgo: number;
  message: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: string[];
  isError?: boolean;
}

/* =========================================================================
   DATA GENERATION (seeded, deterministic across re-renders)
   ========================================================================= */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORY_SERVICES: Record<string, string[]> = {
  API: [
    "gateway",
    "checkout-api",
    "orders-api",
    "users-api",
    "payments-api",
    "search-api",
    "notifications-api",
    "webhooks-api",
    "graphql-gateway",
    "public-api",
    "internal-api",
  ],
  Database: [
    "postgres-primary",
    "postgres-replica",
    "mysql-orders",
    "mongo-catalog",
    "dynamodb-sessions",
    "postgres-analytics",
    "mysql-billing",
    "redshift-warehouse",
    "cockroach-ledger",
  ],
  Infrastructure: [
    "ec2-fleet",
    "k8s-node-pool",
    "autoscaling-group",
    "load-balancer",
    "nat-gateway",
    "vpc-peering",
    "ecs-cluster",
    "lambda-runtime",
    "bastion-host",
  ],
  Security: [
    "tls-cert",
    "waf-rules",
    "iam-policy",
    "secrets-rotation",
    "vulnerability-scan",
    "ddos-shield",
    "firewall-rules",
    "audit-log-shipper",
  ],
  Network: [
    "dns-resolution",
    "cdn-edge",
    "vpn-tunnel",
    "bgp-peering",
    "dns-failover",
    "network-latency",
    "peering-link",
  ],
  Storage: [
    "s3-bucket",
    "ebs-volume",
    "efs-mount",
    "backup-snapshot",
    "glacier-archive",
    "block-storage-pool",
  ],
  Auth: [
    "oauth-provider",
    "sso-gateway",
    "session-store",
    "token-refresh",
    "mfa-service",
    "identity-broker",
  ],
  Queue: [
    "kafka-consumer",
    "sqs-queue",
    "rabbitmq-broker",
    "sns-topic",
    "dead-letter-queue",
    "event-bus",
  ],
  Cache: ["redis-cache", "memcached-cluster", "cdn-cache", "edge-cache", "query-cache"],
  CDN: ["cloudfront-dist", "edge-node", "origin-shield", "static-assets-cdn"],
};

const METRICS = [
  "latency",
  "error-rate",
  "availability",
  "replication-lag",
  "queue-depth",
  "cpu-utilization",
  "memory-usage",
  "disk-io",
  "connection-pool",
  "throughput",
  "cert-expiry",
  "response-time",
];

const REGIONS = [
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-southeast-1",
  "ap-northeast-1",
];

const STATUS_MESSAGES: Record<Status, string[]> = {
  healthy: [
    "All systems nominal",
    "Operating within baseline",
    "No anomalies detected",
    "Passing all synthetic checks",
  ],
  degraded: [
    "Latency 2.1x above baseline",
    "Elevated error rate over last 15m",
    "Intermittent timeouts observed",
    "Resource utilization above threshold",
    "Retrying failed requests, partial success",
  ],
  critical: [
    "3 consecutive failed health checks",
    "Service unreachable from 2 regions",
    "Error rate exceeds 25% over 5m window",
    "Hard dependency unavailable",
  ],
  unknown: [
    "No heartbeat received in 10m",
    "Monitoring agent unresponsive",
    "Last report stale, awaiting data",
  ],
};

function pickStatus(rand: () => number): Status {
  const r = rand();
  if (r < 0.82) return "healthy";
  if (r < 0.93) return "degraded";
  if (r < 0.97) return "critical";
  return "unknown";
}

function generateChecks(count: number): Check[] {
  const rand = mulberry32(20260708);
  const categories = Object.keys(CATEGORY_SERVICES);
  const seen = new Set<string>();
  const checks: Check[] = [];
  let guard = 0;

  while (checks.length < count && guard < count * 20) {
    guard++;
    const category = categories[Math.floor(rand() * categories.length)];
    const services = CATEGORY_SERVICES[category];
    const service = services[Math.floor(rand() * services.length)];
    const metric = METRICS[Math.floor(rand() * METRICS.length)];
    const region = REGIONS[Math.floor(rand() * REGIONS.length)];
    const name = `${service}-${metric}-${region}`;
    if (seen.has(name)) continue;
    seen.add(name);

    const status = pickStatus(rand);
    const msgs = STATUS_MESSAGES[status];
    const message = msgs[Math.floor(rand() * msgs.length)];

    let latencyMs: number;
    let uptime: number;
    if (status === "healthy") {
      latencyMs = Math.round(15 + rand() * 180);
      uptime = 99.5 + rand() * 0.5;
    } else if (status === "degraded") {
      latencyMs = Math.round(200 + rand() * 600);
      uptime = 97 + rand() * 2.4;
    } else if (status === "critical") {
      latencyMs = Math.round(800 + rand() * 2500);
      uptime = 85 + rand() * 11;
    } else {
      latencyMs = 0;
      uptime = 0;
    }

    checks.push({
      id: `chk-${checks.length + 1}`,
      name,
      category,
      status,
      latencyMs,
      uptime: Math.round(uptime * 100) / 100,
      region,
      minutesAgo: Math.floor(rand() * 180),
      message,
    });
  }
  return checks;
}

/* =========================================================================
   HELPERS
   ========================================================================= */

const STATUS_META: Record<Status, { label: string; color: string; order: number }> = {
  critical: { label: "Critical", color: "var(--critical)", order: 0 },
  degraded: { label: "Degraded", color: "var(--degraded)", order: 1 },
  unknown: { label: "Unknown", color: "var(--unknown)", order: 2 },
  healthy: { label: "Healthy", color: "var(--healthy)", order: 3 },
};

function timeAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  return `${h}h ${minutes % 60}m ago`;
}

function fmtLatency(ms: number, status: Status): string {
  if (status === "unknown") return "—";
  return `${ms}ms`;
}

function fmtUptime(u: number, status: Status): string {
  if (status === "unknown") return "—";
  return `${u.toFixed(2)}%`;
}

/* =========================================================================
   RETRIEVAL (lightweight RAG over the in-memory check list)
   ========================================================================= */

function scoreCheck(check: Check, terms: string[]): number {
  const haystack =
    `${check.name} ${check.category} ${check.status} ${check.region} ${check.message}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (term.length < 2) continue;
    if (haystack.includes(term)) score += 1;
  }
  if (terms.includes(check.status)) score += 3;
  if (terms.includes(check.category.toLowerCase())) score += 2;
  if (terms.includes(check.region)) score += 2;
  return score;
}

function retrieveRelevant(query: string, checks: Check[], topN = 10): Check[] {
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\-\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const scored = checks
    .map((c) => ({ c, s: scoreCheck(c, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, topN)
    .map((x) => x.c);

  // Always ensure problem checks are visible, even for broad/overview questions,
  // topping up the slate up to a small cap so the agent can't miss active incidents.
  const ids = new Set(scored.map((c) => c.id));
  const problems = checks
    .filter((c) => (c.status === "critical" || c.status === "degraded") && !ids.has(c.id))
    .slice(0, Math.max(0, 14 - scored.length));

  return [...scored, ...problems].slice(0, 14);
}

function buildContext(relevant: Check[], all: Check[]): string {
  const counts = all.reduce(
    (acc, c) => {
      acc[c.status]++;
      return acc;
    },
    { healthy: 0, degraded: 0, critical: 0, unknown: 0 } as Record<Status, number>
  );

  const summary = `AGGREGATE STATUS (${all.length} checks total): healthy=${counts.healthy}, degraded=${counts.degraded}, critical=${counts.critical}, unknown=${counts.unknown}.`;

  const lines = relevant.map(
    (c) =>
      `- ${c.name} | category=${c.category} | status=${c.status} | latency=${fmtLatency(
        c.latencyMs,
        c.status
      )} | uptime=${fmtUptime(c.uptime, c.status)} | region=${c.region} | updated=${timeAgo(
        c.minutesAgo
      )} | note="${c.message}"`
  );

  return `${summary}\n\nRETRIEVED CHECKS (most relevant to the question):\n${lines.join("\n")}`;
}

/* =========================================================================
   PULSE STRIP (signature element)
   ========================================================================= */

function PulseStrip({ healthyPct }: { healthyPct: number }) {
  const [series, setSeries] = useState<number[]>(() =>
    Array.from({ length: 48 }, () => healthyPct)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1];
        const pull = (healthyPct - last) * 0.15;
        const noise = (Math.random() - 0.5) * 4;
        const next = Math.min(100, Math.max(0, last + pull + noise));
        return [...prev.slice(1), next];
      });
    }, 1800);
    return () => clearInterval(id);
  }, [healthyPct]);

  const w = 100;
  const h = 100;
  const step = w / (series.length - 1);
  const points = series
    .map((v, i) => `${(i * step).toFixed(2)},${(h - (v / 100) * h * 0.86 - 6).toFixed(2)}`)
    .join(" ");

  const avg = series.reduce((a, b) => a + b, 0) / series.length;
  const strokeColor =
    avg >= 90 ? "var(--healthy)" : avg >= 75 ? "var(--degraded)" : "var(--critical)";

  return (
    <div className="pulse-strip">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="pulse-svg">
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={w}
          cy={h - (series[series.length - 1] / 100) * h * 0.86 - 6}
          r="2.4"
          fill={strokeColor}
        />
      </svg>
    </div>
  );
}

/* =========================================================================
   SMALL UI PIECES
   ========================================================================= */

function StatusDot({ status }: { status: Status }) {
  return <span className={`dot dot-${status}`} aria-hidden="true" />;
}

function StatPill({
  status,
  count,
  active,
  onClick,
}: {
  status: Status;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`stat-pill ${active ? "stat-pill-active" : ""}`}
      onClick={onClick}
      style={{ ["--pill-color" as any]: STATUS_META[status].color }}
    >
      <StatusDot status={status} />
      <span className="stat-pill-count">{count}</span>
      <span className="stat-pill-label">{STATUS_META[status].label}</span>
    </button>
  );
}

/* =========================================================================
   CHECK ROW + CATEGORY SECTION
   ========================================================================= */

function CheckRow({
  check,
  onAsk,
}: {
  check: Check;
  onAsk: (question: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="row-wrap">
      <button className="row" onClick={() => setOpen((o) => !o)}>
        <StatusDot status={check.status} />
        <span className="row-name">{check.name}</span>
        <span className="row-region">{check.region}</span>
        <span className="row-metric row-num">{fmtLatency(check.latencyMs, check.status)}</span>
        <span
          className="row-metric row-num"
          style={{
            color: check.uptime < 99 && check.status !== "unknown" ? "var(--degraded)" : undefined,
          }}
        >
          {fmtUptime(check.uptime, check.status)}
        </span>
        <span className="row-updated">{timeAgo(check.minutesAgo)}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="row-detail">
          <span className="row-detail-msg">{check.message}</span>
          <button
            className="ask-btn"
            onClick={() => onAsk(`What's going on with ${check.name}?`)}
          >
            <MessageCircle size={12} />
            Ask agent
          </button>
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  checks,
  defaultOpen,
  onAsk,
}: {
  category: string;
  checks: Check[];
  defaultOpen: boolean;
  onAsk: (q: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const counts = checks.reduce(
    (acc, c) => {
      acc[c.status]++;
      return acc;
    },
    { healthy: 0, degraded: 0, critical: 0, unknown: 0 } as Record<Status, number>
  );

  return (
    <div className="category">
      <button className="category-head" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span className="category-name">{category}</span>
        <span className="category-count">{checks.length}</span>
        <span className="category-badges">
          {counts.critical > 0 && (
            <span className="mini-badge" style={{ ["--c" as any]: "var(--critical)" }}>
              {counts.critical}
            </span>
          )}
          {counts.degraded > 0 && (
            <span className="mini-badge" style={{ ["--c" as any]: "var(--degraded)" }}>
              {counts.degraded}
            </span>
          )}
          {counts.unknown > 0 && (
            <span className="mini-badge" style={{ ["--c" as any]: "var(--unknown)" }}>
              {counts.unknown}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="category-body">
          <div className="row row-header">
            <span style={{ width: 8 }} />
            <span className="row-name">Check</span>
            <span className="row-region">Region</span>
            <span className="row-metric row-num">Latency</span>
            <span className="row-metric row-num">Uptime</span>
            <span className="row-updated">Updated</span>
            <span style={{ width: 14 }} />
          </div>
          {checks.map((c) => (
            <CheckRow key={c.id} check={c} onAsk={onAsk} />
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   CHAT PANEL
   ========================================================================= */

const SUGGESTED_PROMPTS = [
  "What's critical right now?",
  "Summarize database health",
  "Any issues in eu-west-1?",
  "Which category needs attention?",
];

function ChatPanel({ checks }: { checks: Check[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"retrieving" | "thinking" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query || loading) return;

      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: query };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLoading(true);
      setPhase("retrieving");

      try {
        const relevant = retrieveRelevant(query, checks);
        const context = buildContext(relevant, checks);

        setPhase("thinking");

        const systemPrompt =
          "You are an SRE assistant embedded in a health-check dashboard called Systems Pulse, which monitors roughly 500 checks across API, Database, Infrastructure, Security, Network, Storage, Auth, Queue, Cache, and CDN. " +
          "Answer the user's question using ONLY the check data provided below in the prompt. Cite exact check names and numbers when relevant. " +
          "Be concise (2-5 sentences unless a list is clearly needed). If the provided data doesn't cover the question, say so plainly instead of guessing.";

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1000,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: `${context}\n\nQUESTION: ${query}`,
              },
            ],
          }),
        });

        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = await response.json();
        const text = (data.content || [])
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n")
          .trim();

        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: text || "I didn't get a usable response — try rephrasing the question.",
            sources: relevant.slice(0, 6).map((c) => c.name),
          },
        ]);
      } catch (err) {
        setMessages((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            text: "Couldn't reach the agent just now. Check your connection and try again.",
            isError: true,
          },
        ]);
      } finally {
        setLoading(false);
        setPhase(null);
      }
    },
    [checks, loading]
  );

  // expose a global hook so row "Ask agent" buttons can trigger sends
  useEffect(() => {
    (window as any).__pulseAsk = (q: string) => send(q);
    return () => {
      delete (window as any).__pulseAsk;
    };
  }, [send]);

  return (
    <aside className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-title">
          <Sparkles size={15} />
          <span>Agent</span>
        </div>
        <div className="chat-header-sub">RAG over {checks.length} checks</div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>
              Ask about the fleet — the agent retrieves the checks relevant to your question and
              answers from that live data, not memory.
            </p>
            <div className="chip-row">
              {SUGGESTED_PROMPTS.map((p) => (
                <button key={p} className="chip" onClick={() => send(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.role} ${m.isError ? "msg-error" : ""}`}>
            <div className="msg-bubble">{m.text}</div>
            {m.sources && m.sources.length > 0 && (
              <div className="msg-sources">
                <span className="msg-sources-label">Sources</span>
                {m.sources.map((s) => (
                  <span key={s} className="source-chip">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="msg msg-assistant">
            <div className="msg-bubble msg-loading">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-text">
                {phase === "retrieving" ? "Retrieving checks…" : "Thinking…"}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-row">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Ask about a check, category, or region…"
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button className="chat-send" onClick={() => send(input)} disabled={loading || !input.trim()}>
          <Send size={15} />
        </button>
      </div>
    </aside>
  );
}

/* =========================================================================
   MAIN DASHBOARD
   ========================================================================= */

const ALL_STATUSES: Status[] = ["critical", "degraded", "unknown", "healthy"];

export default function HealthDashboard() {
  const checks = useMemo(() => generateChecks(500), []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set());

  const counts = useMemo(() => {
    const acc: Record<Status, number> = { healthy: 0, degraded: 0, critical: 0, unknown: 0 };
    checks.forEach((c) => acc[c.status]++);
    return acc;
  }, [checks]);

  const healthyPct = Math.round((counts.healthy / checks.length) * 100);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return checks.filter((c) => {
      if (statusFilter.size > 0 && !statusFilter.has(c.status)) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        c.category.toLowerCase().includes(term) ||
        c.region.toLowerCase().includes(term)
      );
    });
  }, [checks, search, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Check[]>();
    filtered.forEach((c) => {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    });
    const worstOrder = (list: Check[]) =>
      Math.min(...list.map((c) => STATUS_META[c.status].order));
    return Array.from(map.entries())
      .map(([category, list]) => ({
        category,
        list: list.sort((a, b) => STATUS_META[a.status].order - STATUS_META[b.status].order),
        worst: worstOrder(list),
      }))
      .sort((a, b) => a.worst - b.worst || a.category.localeCompare(b.category));
  }, [filtered]);

  const toggleStatus = (s: Status) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const askAgent = (q: string) => {
    (window as any).__pulseAsk?.(q);
  };

  return (
    <div className="pulse-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

        .pulse-app {
          --bg: #16181a;
          --panel: #1d2023;
          --panel-alt: #202327;
          --border: #2b2f33;
          --text: #e9e6df;
          --text-muted: #8a8f94;
          --text-dim: #5c6166;
          --accent: #5fbfb3;
          --healthy: #4fa98c;
          --degraded: #d9a441;
          --critical: #e0634f;
          --unknown: #6b7280;

          font-family: 'Inter', -apple-system, sans-serif;
          background: var(--bg);
          color: var(--text);
          height: 100vh;
          display: flex;
          overflow: hidden;
          position: relative;
        }
        .pulse-app::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(95,191,179,0.06), transparent 60%);
          z-index: 0;
        }
        .pulse-app * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }

        /* ---------- MAIN ---------- */
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          height: 100vh;
          position: relative;
          z-index: 1;
        }

        .header {
          padding: 22px 28px 16px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--panel-alt), var(--bg));
          flex-shrink: 0;
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 16px;
        }
        .eyebrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 0.18em;
          color: var(--accent);
          text-transform: uppercase;
          margin: 0 0 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .title {
          font-family: 'JetBrains Mono', monospace;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 0 0 4px;
        }
        .subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin: 0;
        }
        .subtitle .mono { color: var(--text); }

        .stat-pills {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .stat-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 11px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 7px;
          cursor: pointer;
          color: var(--text);
          font-family: 'JetBrains Mono', monospace;
          transition: border-color 0.15s, transform 0.1s;
        }
        .stat-pill:hover { border-color: var(--pill-color); transform: translateY(-1px); }
        .stat-pill-active { border-color: var(--pill-color); background: color-mix(in srgb, var(--pill-color) 12%, var(--panel)); }
        .stat-pill-count { font-size: 14px; font-weight: 700; }
        .stat-pill-label { font-size: 10.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

        .pulse-strip { width: 100%; height: 46px; }
        .pulse-svg { width: 100%; height: 100%; display: block; }

        /* ---------- FILTER BAR ---------- */
        .filter-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 28px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .search-box {
          flex: 1;
          max-width: 340px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 7px;
          padding: 8px 12px;
          color: var(--text-muted);
        }
        .search-box input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-size: 13px;
          width: 100%;
          font-family: 'Inter', sans-serif;
        }
        .search-box input::placeholder { color: var(--text-dim); }
        .filter-chips { display: flex; gap: 6px; }
        .filter-chip {
          padding: 7px 12px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .filter-chip.on { border-color: var(--c); color: var(--text); background: color-mix(in srgb, var(--c) 14%, transparent); }
        .result-count {
          margin-left: auto;
          font-size: 12px;
          color: var(--text-dim);
          font-family: 'JetBrains Mono', monospace;
        }

        /* ---------- GRID ---------- */
        .grid-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 8px 28px 28px;
        }
        .category { border-bottom: 1px solid var(--border); }
        .category-head {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 4px;
          background: transparent;
          border: none;
          color: var(--text);
          cursor: pointer;
          text-align: left;
        }
        .category-name { font-weight: 600; font-size: 13.5px; }
        .category-count {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          color: var(--text-dim);
          background: var(--panel);
          padding: 2px 7px;
          border-radius: 10px;
        }
        .category-badges { display: flex; gap: 5px; margin-left: 4px; }
        .mini-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          font-weight: 700;
          color: var(--bg);
          background: var(--c);
          padding: 1px 6px;
          border-radius: 9px;
        }
        .category-body { padding-bottom: 6px; }

        .row-wrap { }
        .row {
          width: 100%;
          display: grid;
          grid-template-columns: 10px 1fr 100px 76px 76px 84px 14px;
          align-items: center;
          gap: 14px;
          padding: 7px 6px 7px 4px;
          background: transparent;
          border: none;
          border-radius: 5px;
          color: var(--text);
          cursor: pointer;
          text-align: left;
        }
        .row:hover { background: var(--panel); }
        .row-header {
          cursor: default;
          padding-top: 2px;
          padding-bottom: 8px;
        }
        .row-header:hover { background: transparent; }
        .row-header span { font-size: 10.5px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
        .row-name {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12.5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .row-region { font-size: 11.5px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
        .row-metric { font-size: 12px; color: var(--text-muted); }
        .row-num { font-family: 'JetBrains Mono', monospace; text-align: right; font-variant-numeric: tabular-nums; }
        .row-updated { font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }

        .row-detail {
          margin: 0 4px 8px 24px;
          padding: 9px 12px;
          background: var(--panel);
          border-left: 2px solid var(--border);
          border-radius: 0 6px 6px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .row-detail-msg { font-size: 12px; color: var(--text-muted); }
        .ask-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--accent);
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 5px 9px;
          cursor: pointer;
        }
        .ask-btn:hover { border-color: var(--accent); }

        .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dot-healthy { background: var(--healthy); }
        .dot-degraded { background: var(--degraded); }
        .dot-critical { background: var(--critical); box-shadow: 0 0 0 3px color-mix(in srgb, var(--critical) 25%, transparent); }
        .dot-unknown { background: var(--unknown); }

        /* ---------- CHAT PANEL ---------- */
        .chat-panel {
          width: 380px;
          flex-shrink: 0;
          background: var(--panel-alt);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: relative;
          z-index: 1;
        }
        .chat-header { padding: 18px 18px 14px; border-bottom: 1px solid var(--border); }
        .chat-header-title { display: flex; align-items: center; gap: 7px; font-weight: 600; font-size: 14px; color: var(--accent); }
        .chat-header-sub { font-size: 11.5px; color: var(--text-dim); margin-top: 3px; font-family: 'JetBrains Mono', monospace; }

        .chat-scroll { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
        .chat-empty p { font-size: 13px; color: var(--text-muted); line-height: 1.55; margin: 4px 0 14px; }
        .chip-row { display: flex; flex-wrap: wrap; gap: 7px; }
        .chip {
          font-size: 12px;
          color: var(--text);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 7px 12px;
          cursor: pointer;
          text-align: left;
        }
        .chip:hover { border-color: var(--accent); color: var(--accent); }

        .msg { display: flex; flex-direction: column; gap: 6px; }
        .msg-user { align-items: flex-end; }
        .msg-assistant { align-items: flex-start; }
        .msg-bubble {
          max-width: 92%;
          padding: 10px 13px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .msg-user .msg-bubble { background: color-mix(in srgb, var(--accent) 18%, var(--panel)); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); }
        .msg-assistant .msg-bubble { background: var(--panel); border: 1px solid var(--border); }
        .msg-error .msg-bubble { border-color: var(--critical); color: var(--critical); }

        .msg-sources { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
        .msg-sources-label { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-right: 2px; }
        .source-chip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--text-muted);
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 2px 6px;
        }

        .msg-loading { display: flex; align-items: center; gap: 8px; }
        .loading-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent);
          animation: pulse-blink 1.1s infinite ease-in-out;
        }
        .loading-dot:nth-child(2) { animation-delay: 0.15s; }
        .loading-dot:nth-child(3) { animation-delay: 0.3s; }
        .loading-text { font-size: 12px; color: var(--text-dim); margin-left: 3px; }
        @keyframes pulse-blink { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }

        .chat-input-row {
          display: flex;
          gap: 8px;
          padding: 14px;
          border-top: 1px solid var(--border);
          align-items: flex-end;
        }
        .chat-input {
          flex: 1;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 9px 12px;
          color: var(--text);
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          resize: none;
          outline: none;
          max-height: 100px;
        }
        .chat-input:focus { border-color: var(--accent); }
        .chat-send {
          width: 36px; height: 36px;
          border-radius: 8px;
          background: var(--accent);
          border: none;
          color: var(--bg);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .chat-send:disabled { opacity: 0.35; cursor: not-allowed; }

        ::-webkit-scrollbar { width: 9px; height: 9px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }

        @media (max-width: 900px) {
          .chat-panel { display: none; }
        }
      `}</style>

      <div className="main">
        <div className="header">
          <div className="header-top">
            <div>
              <p className="eyebrow">
                <Activity size={11} /> Signal Room
              </p>
              <h1 className="title">Systems Pulse</h1>
              <p className="subtitle">
                <span className="mono">{checks.length}</span> checks ·{" "}
                <span className="mono">{healthyPct}%</span> healthy · updated{" "}
                <span className="mono">just now</span>
              </p>
            </div>
            <div className="stat-pills">
              {ALL_STATUSES.map((s) => (
                <StatPill
                  key={s}
                  status={s}
                  count={counts[s]}
                  active={statusFilter.has(s)}
                  onClick={() => toggleStatus(s)}
                />
              ))}
            </div>
          </div>
          <PulseStrip healthyPct={healthyPct} />
        </div>

        <div className="filter-bar">
          <div className="search-box">
            <Search size={14} />
            <input
              placeholder="Search checks, category, region…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <X size={14} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />
            )}
          </div>
          <span className="result-count">
            {filtered.length} / {checks.length} shown
          </span>
        </div>

        <div className="grid-scroll">
          {grouped.map(({ category, list }) => (
            <CategorySection
              key={category}
              category={category}
              checks={list}
              defaultOpen={list.some((c) => c.status === "critical" || c.status === "degraded")}
              onAsk={askAgent}
            />
          ))}
          {grouped.length === 0 && (
            <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "20px 4px" }}>
              No checks match the current filters.
            </p>
          )}
        </div>
      </div>

      <ChatPanel checks={checks} />
    </div>
  );
}
