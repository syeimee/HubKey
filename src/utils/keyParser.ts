import { HubKeyIssue, ParsedKey } from '../models/types';

const KEY_PATTERN = /^([A-Z][A-Z0-9_-]{0,9})(?:-(\d+))?$/;
const MARKER_PATTERN = /<!-- hubkey:([A-Z][A-Z0-9_-]{0,9})-(\d+) -->/;

export function parseProjectKey(input: string): ParsedKey | null {
  const match = input.trim().toUpperCase().match(KEY_PATTERN);
  if (!match) {
    return null;
  }
  return {
    key: match[1],
    number: match[2] ? parseInt(match[2], 10) : undefined,
  };
}

export function parseMarkerFromBody(body: string): { key: string; number: number } | null {
  const match = body.match(MARKER_PATTERN);
  if (!match) {
    return null;
  }
  return {
    key: match[1],
    number: parseInt(match[2], 10),
  };
}

export function buildMarker(key: string, number: number): string {
  return `<!-- hubkey:${key}-${number} -->`;
}

export function matchesSearch(issue: HubKeyIssue, query: string): boolean {
  const parsed = parseProjectKey(query);
  if (!parsed) {
    return issue.title.toLowerCase().includes(query.toLowerCase());
  }
  if (parsed.number !== undefined) {
    return issue.projectKey === parsed.key && issue.keyNumber === parsed.number;
  }
  return issue.projectKey === parsed.key;
}
