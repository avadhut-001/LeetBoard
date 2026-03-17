import React, { useState } from "react";
import { X, Search, Tag, BookOpen, AlertCircle } from "lucide-react";

const difficultyColor = {
  Easy:   { text: "text-green-400",  bg: "bg-green-400/10  border-green-400/30"  },
  Medium: { text: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  Hard:   { text: "text-red-400",    bg: "bg-red-400/10    border-red-400/30"    },
};

// ── LeetCode GraphQL via CORS proxy ──────────────────────────────────────────
const PROXY = "https://corsproxy.io/?url=https://leetcode.com/graphql";

const fetchBySlug = async (slug) => {
  const body = {
    query: `
      query getQuestion($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionFrontendId
          title
          titleSlug
          difficulty
          content
          topicTags { name }
          hints
        }
      }
    `,
    variables: { titleSlug: slug },
  };

  const res = await fetch(PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const q = json?.data?.question;
  if (!q || !q.title) throw new Error("Not found");
  return q;
};

// Find slug by problem number
const fetchSlugByNumber = async (num) => {
  const body = {
    query: `
      query problemsetList($skip: Int, $limit: Int) {
        problemsetQuestionList: questionList(
          categorySlug: ""
          limit: $limit
          skip: $skip
          filters: {}
        ) {
          questions: data {
            frontendQuestionId: questionFrontendId
            titleSlug
          }
        }
      }
    `,
    variables: { skip: parseInt(num) - 1, limit: 1 },
  };

  const res = await fetch(PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const list = json?.data?.problemsetQuestionList?.questions;
  if (!list || list.length === 0) throw new Error("Not found");
  return list[0].titleSlug;
};

// ─────────────────────────────────────────────────────────────────────────────

const LeetCodePanel = ({ isOpen, onClose, onQuestionChange, restoredQuestion }) => {
  const [query, setQuery]       = useState("");
  const [question, setQuestion] = useState(restoredQuestion ?? null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  // When a session is loaded, restoredQuestion changes — sync it in
  React.useEffect(() => {
    if (restoredQuestion) setQuestion(restoredQuestion);
  }, [restoredQuestion]);

  const search = async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setQuestion(null);

    try {
      let slug = "";

      if (/^\d+$/.test(q)) {
        slug = await fetchSlugByNumber(q);
      } else {
        slug = q.toLowerCase().replace(/\s+/g, "-");
      }

      const data = await fetchBySlug(slug);

      const newQuestion = {
        id:         data.questionFrontendId,
        title:      data.title,
        difficulty: data.difficulty,
        topics:     data.topicTags ?? [],
        content:    data.content ?? "",
        hints:      data.hints ?? [],
      };
      setQuestion(newQuestion);
      // notify parent so it can save id+title for filename
      onQuestionChange?.({ id: newQuestion.id, title: newQuestion.title });
    } catch (err) {
      setError('Problem not found. Try the exact name (e.g. "two sum") or number (e.g. "1").');
    }

    setLoading(false);
  };

  const handleKey = (e) => { if (e.key === "Enter") search(); };

  const diff = question ? difficultyColor[question.difficulty] : null;

  return (
    <div
      className={`fixed top-0 left-0 h-screen w-[440px] bg-[#1a1a1a] text-white border-r border-[#2a2a2a] shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-[#ffa116]" />
          <span className="font-bold text-base tracking-tight">LeetCode</span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* SEARCH */}
      <div className="px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder='Try "1" or "two sum"'
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-[#252525] outline-none border border-[#333] focus:border-[#ffa116] transition-colors placeholder-gray-600"
          />
          <button
            onClick={search}
            disabled={loading}
            className="px-4 py-2 bg-[#ffa116] text-black rounded-lg hover:bg-[#ffb347] transition-colors font-semibold text-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <Search size={14} />
            {loading ? "…" : "Go"}
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 bg-[#ffa116] rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="m-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2 items-start">
            <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !question && (
          <div className="flex flex-col items-center justify-center h-52 gap-3 text-gray-600">
            <Search size={32} strokeWidth={1.2} />
            <p className="text-sm">Search a problem to get started</p>
          </div>
        )}

        {/* Question */}
        {!loading && question && (
          <div className="p-5">
            <p className="text-xs text-gray-500 font-mono mb-1">#{question.id}</p>
            <h2 className="text-base font-bold leading-snug mb-3">{question.title}</h2>

            {diff && (
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border mb-4 ${diff.text} ${diff.bg}`}>
                {question.difficulty}
              </span>
            )}

            {question.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {question.topics.map((t, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-[#252525] text-gray-400 border border-[#333]">
                    <Tag size={9} />{t.name}
                  </span>
                ))}
              </div>
            )}

            {/* Description — raw LeetCode HTML */}
            <div
              className="lc-content text-sm text-gray-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: question.content }}
            />

            {/* Hints */}
            {question.hints.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Hints</p>
                {question.hints.map((h, i) => (
                  <details key={i} className="mb-2 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 cursor-pointer">
                    <summary className="text-xs text-gray-400 select-none">Hint {i + 1}</summary>
                    <p className="text-xs text-gray-300 mt-2" dangerouslySetInnerHTML={{ __html: h }} />
                  </details>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scoped styles for LeetCode HTML */}
      <style>{`
        /* Hide scrollbar but keep scroll working */
        .flex-1.overflow-y-auto::-webkit-scrollbar { display: none; }
        .flex-1.overflow-y-auto { -ms-overflow-style: none; scrollbar-width: none; }

        .lc-content p { margin-bottom: 0.7rem; }
        .lc-content pre {
          background: #252525; border: 1px solid #333; border-radius: 8px;
          padding: 10px 14px; font-size: 12px; overflow-x: auto;
          margin-bottom: 0.75rem; color: #e0e0e0;
          font-family: 'Fira Code', monospace;
        }
        .lc-content code {
          background: #2c2c2c; border-radius: 4px; padding: 1px 5px;
          font-size: 12px; color: #ffa116; font-family: 'Fira Code', monospace;
        }
        .lc-content pre code { background: transparent; padding: 0; color: inherit; }
        .lc-content strong { color: #fff; font-weight: 600; }
        .lc-content ul, .lc-content ol { padding-left: 1.3rem; margin-bottom: 0.75rem; }
        .lc-content li { margin-bottom: 0.3rem; }
        .lc-content img { max-width: 100%; border-radius: 6px; margin: 0.5rem 0; }
        .lc-content sup { font-size: 10px; }
        .lc-content a { color: #ffa116; text-decoration: underline; }
      `}</style>
    </div>
  );
};

export default LeetCodePanel;