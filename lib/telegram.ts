const TOKEN_ENV = ["API_KEY_BOT", "TELEGRAM_BOT_TOKEN"] as const;

function botToken() {
  for (const k of TOKEN_ENV) {
    const v = process.env[k];
    if (v) return v;
  }
  return undefined;
}

export async function sendTelegramMessage(text: string) {
  const token = botToken();
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) {
    return { sent: false, reason: "not_configured" as const };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4000),
      disable_web_page_preview: true,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; description?: string };
  if (!res.ok || !data.ok) {
    return {
      sent: false,
      reason: "api_error" as const,
      detail: data.description ?? res.statusText,
    };
  }
  return { sent: true as const };
}
