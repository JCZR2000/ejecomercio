# Instrucciones para Claude

Las reglas de trabajo de este proyecto están en [REGLAS.md](REGLAS.md). Síguelas siempre, sobre todo:

## Al empezar una sesión
1. Lee `Proyecto/Estado actual.md` de la bóveda (`C:\Users\juan2\Documentos\Obsidian\EjeComercio`).
2. Si la tarea es de una fase, lee solo el plan de esa fase en `Proyecto/Planes/` (estado "listo para ejecutar").
3. Lee otras notas solo si la tarea las necesita. No leas `Proyecto/Planes/` completa ni todo el `Diario/`.

- Antes de planificar algo que toque datos, sincronización, dominio o Service Worker, lee «Dónde viven los datos» (REGLAS.md, sección 5) y compruébalo en el código. No supongas que los datos solo están en el teléfono: la sesión es obligatoria y todo se sube a Firebase.
- Antes de planificar o cambiar código, haz la «Revisión de impacto» (REGLAS.md, sección 5): bóveda del módulo, Grep de los llamadores, graphify para las relaciones y lectura del código alrededor. Anota qué más puede afectar y pruébalo también.
- Al terminar, registra el trabajo según REGLAS.md, sección 1.
- No uses subagentes (Agent, graphify como subagente) salvo que el usuario lo pida explícitamente.
- Para buscar en la bóveda y en el código usa Grep o Glob directamente: es lo más barato y exacto. `index.html` es muy grande: lee solo los rangos de líneas que necesites.

@REGLAS.md

## graphify (solo relaciones del código, opcional)

- Para encontrar un archivo, una función o un texto, usa Grep o Glob. No uses graphify para eso.
- Usa `graphify query "<pregunta>"`, `graphify path "<A>" "<B>"` o `graphify explain "<concepto>"` para preguntas de relación (qué depende de qué, por dónde pasa un flujo), y solo si existe `graphify-out/`. Son desde Bash. Úsalo en la revisión de impacto de cada cambio, no solo cuando sobre tiempo.
- Tras modificar código, si existe `graphify-out/`, ejecuta `graphify update .` desde la carpeta del proyecto. No gasta tokens.
- Para la bóveda de Obsidian, no se usa graphify: usa Grep o Read.
