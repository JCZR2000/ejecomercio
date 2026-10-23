# Instrucciones para Claude

Las reglas de trabajo de este proyecto están en [REGLAS.md](REGLAS.md). Síguelas siempre, sobre todo:

## Al empezar una sesión
1. Lee `Proyecto/Estado actual.md` de la bóveda (`C:\Users\juan2\Documentos\Obsidian\EjeComercio`).
2. Si la tarea es de una fase, lee solo el plan de esa fase en `Proyecto/Planes/` (estado "listo para ejecutar").
3. Lee otras notas solo si la tarea las necesita. No leas `Proyecto/Planes/` completa ni todo el `Diario/`.

- Al terminar, registra el trabajo según REGLAS.md, sección 1.
- No uses subagentes (Agent, graphify como subagente) salvo que el usuario lo pida explícitamente.
- Para buscar en la bóveda y en el código usa Grep o Glob directamente: es lo más barato y exacto. `index.html` es muy grande: lee solo los rangos de líneas que necesites.

@REGLAS.md

## graphify (solo relaciones del código, opcional)

- Para encontrar un archivo, una función o un texto, usa Grep o Glob. No uses graphify para eso.
- Usa `graphify query "<pregunta>"`, `graphify path "<A>" "<B>"` o `graphify explain "<concepto>"` solo para preguntas de relación (qué depende de qué, por dónde pasa un flujo), y solo si existe `graphify-out/`. Son desde Bash.
- Tras modificar código, si existe `graphify-out/`, ejecuta `graphify update .` desde la carpeta del proyecto. No gasta tokens.
- Para la bóveda de Obsidian, no se usa graphify: usa Grep o Read.
