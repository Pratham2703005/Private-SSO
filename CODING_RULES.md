Rules the AI Agent MUST follow while adding code:

1. Ask 1 clear clarification question if anything is ambiguous. Never assume silently.
2. Follow best coding principles: clean, maintainable, scalable.
3. TypeScript strict only. No implicit types.
4. You can't use: any, never, unknown, undefined in the codebase.
5. No ts-ignore, no @ts-expect-error, no disabling lint rules.
6. No quick hacks, no temporary code, no TODO placeholders unless user explicitly allows.
7. Keep code DRY. If logic repeats 2+ times → extract it.
8. Keep functions small + single responsibility (one job per function).
9. No business logic inside React components.
10. Put business logic in: lib/ or services/ (server) and keep UI dumb.
11. Put shared helpers in utils/ (pure functions only).
12. Put constants in constants/ (no magic strings/numbers).
13. Put types in types/ (no inline large types).
14. No duplicate types across files — reuse shared types.
15. Always validate input on server side (zod or manual strict validation).
16. Never trust client-side validation.
17. All API routes must have:
    - auth checks (if required)
    - role checks (if required)
    - proper status codes
    - consistent error format
18. Never leak secrets in responses (client_secret, refresh tokens, etc).
19. Never log sensitive data (passwords, tokens, secrets).
20. Use secure cookies for sessions (HttpOnly, SameSite, Secure in prod).
21. Follow least privilege: only request/store the minimum needed data.
22. Use consistent naming:
    - camelCase for variables/functions
    - PascalCase for components/types
    - kebab-case for routes
23. Keep folder structure consistent. Don’t create random folders.
24. Use reusable components (buttons, inputs, modals, tables).
25. Avoid prop drilling for auth/session — use a single clean pattern.
26. No breaking changes without telling the user clearly.
27. Prefer composition over duplication.
28. Prefer explicit code over clever code.
29. Every DB write must be safe:
    - validate
    - check permissions
    - handle conflicts
30. Every DB query must be scoped:
    - by user_id
    - by account_id
    - by client_id
31. Use transactions when multiple writes must succeed together.
32. Always handle edge cases:
    - missing session
    - revoked session
    - inactive client
    - invalid redirect_uri
33. Keep errors user-friendly but developer-usable.
34. No tests unless user explicitly asks for tests.
35. No documentation unless user explicitly asks for documentation.
36. No markdown output unless user explicitly asks for markdown.
37. No refactors outside requested scope unless necessary for correctness/security.
38. Prefer server-side enforcement over client-side assumptions.
39. Always keep the IDP as the source of truth.
40. If a rule conflicts with security/best practice → security wins.
