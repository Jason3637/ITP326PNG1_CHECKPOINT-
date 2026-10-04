// The backend's PRIME preview 400s, in customer words. The range comes from
// the backend's own message ("amount_requested must be between K100 and
// K1,000. ...") so it follows whatever tiers the administrator has set.
export function primeRangeMessage(backendMessage: string): string {
  const range = /between (K[\d,]+) and (K[\d,]+)/.exec(backendMessage);
  if (range) return `PRIME loans are available from ${range[1]} to ${range[2]}, in whole Kina.`;
  if (/whole-Kina/i.test(backendMessage)) return "Enter a whole-Kina amount (no toea).";
  return "Enter an amount within the PRIME loan range, in whole Kina.";
}
