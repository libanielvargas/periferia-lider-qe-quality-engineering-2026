# Ejecución real en GitHub Actions

- **Run:** https://github.com/libanielvargas/periferia-lider-qe-quality-engineering-2026/actions/runs/40805453568
- **Evento:** push a `main`, commit `1c736d3`. Inicio 2026-10-29 02:17:18 UTC; fin 02:23:19 UTC.
- **Conclusión:** `success`.

## Job «Pruebas E2E (Playwright)»: success

- `15 passed (8.7s)`: 13 conformes y 2 defectos abiertos como fallo esperado (DEF-01 y DEF-02 aparecen con ✘ esperado en el log).
- Artefacto `playwright-report` (3,3 MB) publicado. `playwright-failure-artifacts` no se generó porque no hubo fallos inesperados.

## Job «Rendimiento (k6)»: success (50 VUs, 5 min, corrida completa en push a `main`)

| Umbral | Resultado |
|---|---|
| `p(95)<800` | p95 = **3,27 ms** |
| `http_req_failed rate<0.01` | **0,00 %** (0 de 15 001) |
| `checks rate>0.99` | **100 %** (45 000 de 45 000) |

Artefacto `k6-results` publicado. El runner de GitHub es más rápido que la medición local (p95 de 18,84 ms); ambas cumplen el umbral con amplio margen.
