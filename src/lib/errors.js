// Turns Atlassian API failures into messages an agent can show to a user: no status codes,
// response bodies or stack traces. The full detail stays in the app logs.

export function friendlyError(err, action) {
  const status = err?.status;
  if (status === 401 || err?.message === 'Authentication Required') {
    return `I could not ${action}: Atlassian asked for access again. Reload the page, accept any "Allow access" prompt and try again.`;
  }
  if (status === 403) return `I could not ${action}: you do not have permission for that here.`;
  if (status === 404) return `I could not ${action}: it no longer exists, or you cannot see it.`;
  if (status === 409) return `I could not ${action}: something with the same name already exists.`;
  if (status === 429) return `I could not ${action}: Atlassian is rate-limiting requests. Wait a minute and try again.`;
  if (status >= 500) return `I could not ${action}: Atlassian had a temporary problem. Try again in a minute.`;
  return `I could not ${action}. Try again, and if it keeps failing, check the page and permissions.`;
}
