export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request(method: string, url: string, body?: unknown, hostToken?: string | null) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(hostToken ? { "x-host-token": hostToken } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const apiClient = {
  post: (url: string, body?: unknown, hostToken?: string | null) => request("POST", url, body, hostToken),
  put: (url: string, body?: unknown, hostToken?: string | null) => request("PUT", url, body, hostToken),
  patch: (url: string, body?: unknown, hostToken?: string | null) => request("PATCH", url, body, hostToken),
};
