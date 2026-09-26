const API_BASE_URL = process.env.EXPO_PUBLIC_JARVIS_WEB_URL || "https://jarvishud-wmuh6urn.manus.space";

export type ApiUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  preferences?: Record<string, unknown>;
};

export type ApiTask = {
  id: number;
  title: string;
  details?: string | null;
  dueAt?: string | null;
  recurrence?: string | null;
  status: "pending" | "done" | "cancelled";
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `JARVIS Web respondeu HTTP ${response.status}`);
  return payload as T;
}

export async function signIn(email: string, password: string) {
  return request<{ success: boolean; sessionToken?: string; user: ApiUser }>("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password, mobile: true }),
  });
}

export async function getProfile(token: string) {
  return request<{ user: ApiUser }>("/api/auth/profile", {}, token);
}

export async function getChatHistory(token: string) {
  return request<{ messages: Array<{ id: string; sender: "USER" | "JARVIS"; text: string; timestamp: string }> }>("/api/assistant/chat-history", {}, token);
}

export async function saveChatHistory(token: string, messages: unknown[]) {
  return request<{ success: boolean }>("/api/assistant/chat-history", {
    method: "PUT",
    body: JSON.stringify({ messages }),
  }, token);
}

export async function getTasks(token: string) {
  return request<{ tasks: ApiTask[] }>("/api/assistant/tasks", {}, token);
}

export async function createTask(token: string, task: { title: string; details?: string; dueAt?: string }) {
  return request<ApiTask>("/api/assistant/tasks", {
    method: "POST",
    body: JSON.stringify(task),
  }, token);
}

export async function updateTask(token: string, id: number, status: "pending" | "done" | "cancelled") {
  return request<{ success: boolean }>(`/api/assistant/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }, token);
}

export async function createAutomation(token: string, automation: {
  name: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
}) {
  return request<{ id: number; scheduleError?: string }>("/api/assistant/automations", {
    method: "POST",
    body: JSON.stringify(automation),
  }, token);
}

export { API_BASE_URL };
