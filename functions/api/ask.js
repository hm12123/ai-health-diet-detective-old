// 이 파일은 안 고쳐도 됩니다. 고칠 곳은 functions/_config.js 입니다.
//
// 하는 일: _config.js 의 설정으로 지시문을 만들어 Workers AI 에 보내고,
//          「답」 또는 「되물음」 중 하나를 돌려줍니다.
//
// 저장하지 않습니다. 사용자가 보낸 글을 로그에 남기지 않습니다.
// 이 줄을 지우려면 AGENTS.md 의 금지 항목도 같이 고치세요.

import { 대상, 하는일, 기준, 멈춤, 모델 } from "../_config.js";

const 지시문 = `당신은 아래 사람을 위해 일합니다.

[쓰는 사람]
${대상.trim()}

[해야 할 일]
${하는일.trim()}

[잘된 것의 기준]
${기준.map((c, i) => `${i + 1}. ${c}`).join("\n")}

[멈추는 지점]
${멈춤.trim()}

멈추는 지점에 해당하면 추측해서 답하지 말고 status 를 "ask" 로 두고,
text 에는 되물을 질문을 한 문장만 적습니다.
답할 수 있으면 status 를 "answer" 로 두고 text 에 한국어 답변을 적습니다.
text 는 언제나 문자열 하나입니다.`;

// 모델이 스키마를 지키게 한다.
const 스키마 = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answer", "ask"] },
    text: { type: "string" },
  },
  required: ["status", "text"],
};

// 무엇이 오든 사람이 읽을 문자열 하나로 만든다.
function 글로(x) {
  if (x === null || x === undefined) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  if (Array.isArray(x)) return x.map(글로).filter(Boolean).join("\n");
  if (typeof x === "object") {
    for (const k of ["text", "response", "output_text", "content", "message"]) {
      const v = x[k];
      if (typeof v === "string" && v.trim()) return v;
      if (v && typeof v === "object") { const t = 글로(v); if (t) return t; }
    }
    try { return JSON.stringify(x); } catch { return ""; }
  }
  return "";
}

function 객체로(x) {
  if (x && typeof x === "object" && !Array.isArray(x)) return x;
  if (typeof x === "string") {
    const s = x.indexOf("{"), e = x.lastIndexOf("}");
    if (s !== -1 && e > s) { try { return JSON.parse(x.slice(s, e + 1)); } catch { return null; } }
  }
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const 디버그 = new URL(request.url).searchParams.get("debug") === "1";

  let 입력 = "";
  try {
    const body = await request.json();
    입력 = (body && typeof body.입력 === "string") ? body.입력.trim() : "";
  } catch { 입력 = ""; }

  // 모델을 부르기 전에 거르는 1차 멈춤. 한도도 아끼고, 멈춤이 눈에 보입니다.
  if (입력.length < 5) {
    return Response.json({ 상태: "물음", 내용: "무엇을 도와드릴지 한 줄만 적어 주세요." });
  }

  const 메시지 = [
    { role: "system", content: 지시문 },
    { role: "user", content: 입력 },
  ];

  let 결과 = null;
  try {
    결과 = await env.AI.run(모델, {
      messages: 메시지,
      max_tokens: 700,
      response_format: { type: "json_schema", json_schema: 스키마 },
    });
  } catch {
    // 스키마를 못 지키는 모델이면 한 번만 평범하게 다시 부른다.
    try {
      결과 = await env.AI.run(모델, { messages: 메시지, max_tokens: 700 });
    } catch {
      return Response.json(
        { 상태: "오류", 내용: "지금은 답할 수 없습니다. 하루 사용 한도를 넘었거나 모델 이름이 틀렸을 수 있습니다." },
        { status: 503 },
      );
    }
  }

  const 원시 = (결과 && 결과.response !== undefined) ? 결과.response : 결과;
  const 구조 = 객체로(원시);
  const 본문 = { 상태: "답", 내용: "" };

  if (구조 && typeof 구조.status === "string") {
    본문.상태 = (구조.status === "ask") ? "물음" : "답";
    본문.내용 = 글로(구조.text).trim();
  }
  if (!본문.내용) 본문.내용 = 글로(원시).trim() || "답을 만들지 못했습니다.";
  if (디버그) 본문._원문 = (typeof 원시 === "string" ? 원시 : JSON.stringify(원시)).slice(0, 600);
  return Response.json(본문);
}
