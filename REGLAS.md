# Reglas del proyecto

Forma de trabajar en **EjeComercio**. Valen para cualquier persona, agente o sesión que trabaje en este proyecto. Léelas antes de empezar.

## 1. Bóveda de Obsidian: el segundo cerebro

**Ubicación:**

```
C:\Users\juan2\Documentos\Obsidian\EjeComercio
```

La bóveda es la **fuente principal de contexto** del proyecto: qué se hizo, qué falta, por qué está hecho así y en qué versión estamos.

> La carpeta del código (`EjeComercio` en el Escritorio) **no** es la bóveda. No escribas notas aquí.

### Organización
| Ruta en la bóveda | Contenido | Clasificación |
| --- | --- | --- |
| `Inicio.md` | Portada de la bóveda | — |
| `Proyecto/Estado actual.md` | Punto de entrada: versión, último diario, último plan y pendientes prioritarios | — |
| `Proyecto/EjeComercio — Índice.md` | Tablas de versiones y módulos | — |
| `Proyecto/Pendientes del proyecto.md` | Lo que falta, con casillas | — |
| `Proyecto/Decisiones.md` | Decisiones con fecha (lo más nuevo arriba) | — |
| `Proyecto/Infraestructura.md` | Firebase, hosting, librerías, comandos, lecciones aprendidas | — |
| `Proyecto/Diario/AAAA-MM-DD.md` | Una nota por día de trabajo | **Por día** |
| `Proyecto/Versiones/vXX.Y — Título.md` | Una nota por versión | **Por versión** |
| `Proyecto/Módulos/<Nombre>.md` | Una nota por módulo | **Por nombre** |
| `Proyecto/Planes/AAAA-MM-DD — Fase N — Título.md` | Planes de cada fase (ver sección 2) | **Por día y fase** |
| `Plantillas/` | Plantillas de nota diaria y de versión | — |

Las notas se escriben en español, llevan propiedades (`tipo`, `fecha`, `version`, `estado`) y se enlazan entre sí con `[[enlaces]]`.

### Antes de empezar cualquier tarea
1. Lee `Proyecto/Estado actual.md`. Es el punto de entrada.
2. Si la tarea es de una fase, lee solo su plan en `Proyecto/Planes/` (el que tiene `estado: listo para ejecutar`). No leas la carpeta completa.
3. Lee otras notas solo si la tarea las necesita: `Pendientes del proyecto`, la nota de la **versión actual**, las notas del **módulo** que vas a tocar y las **Decisiones** relacionadas. No leas todo el `Diario/`.
4. Si una nota y el código no coinciden, manda el código: revísalo y corrige la nota.

### Al terminar cada trabajo
1. Crea o actualiza la nota del **día** (`Proyecto/Diario/AAAA-MM-DD.md`, usando la plantilla).
2. Actualiza la nota de cada **módulo** afectado (su historial y sus pendientes).
3. Si se publicó algo, crea o actualiza la nota de la **versión** y la tabla del índice.
4. Marca lo terminado y añade lo nuevo en `Pendientes del proyecto`.
5. Anota en `Decisiones` cualquier decisión tomada con el usuario.
6. Actualiza `Proyecto/Estado actual.md`. **Cada cambio de reglas** (REGLAS.md, CLAUDE.md o AGENTS.md), aunque sea pequeño, también se anota ahí.
   - Esta nota es **corta y solo con lo vigente**: la versión actual, la anterior y lo prioritario. El historial completo va en el índice, en `Versiones/` y en el `Diario/`; no se acumula aquí.

## 2. Papeles: arquitecto y ejecución
El trabajo se reparte entre dos tipos de sesión. El modelo lo elige el usuario al abrir cada sesión; esta tabla dice cuál usar:

| Tarea | Modelo | Ejemplos |
| --- | --- | --- |
| Planificación | **Opus** | Diseñar una fase, elegir un enfoque, errores que afectan a varios módulos, todo lo que toque dinero, tasas, fiados, factura fiscal, sincronización, cifrado o reglas de Firestore |
| Programación | **Sonnet** | Implementar un plan ya escrito, con su prueba |
| Consultas y trabajos pequeños | **Haiku** | Notas de la bóveda, textos, renombrados, búsquedas, preguntas sobre el proyecto |
| Cierre de fase (commit, publicación y actualización de la bóveda) | **Sonnet**, dentro de la sesión de ejecución | Commit, publicación tras aprobación, diario, versión, `Estado actual` |

Si una sesión recibe una tarea que no corresponde a su modelo, lo dice al usuario antes de seguir, para que abra la sesión adecuada.

- **Sesión arquitecto (planificación):**
  - Conversa con el usuario, investiga el código y diseña cada fase.
  - **No escribe código.**
  - Guarda cada plan en la bóveda, en `Proyecto/Planes/AAAA-MM-DD — Fase N — Título.md`, con `estado: listo para ejecutar`.
  - Cada plan dice qué funciones de `index.html` se tocan, cómo se prueba y si cambia la forma de los datos guardados (ver sección 5).
  - Entrega al usuario el **prompt** para la sesión de ejecución.
- **Sesión de ejecución:**
  - Recibe ese prompt, lee `REGLAS.md` y el plan, y lo implementa tal cual.
  - Al empezar cambia el `estado` del plan a `en ejecución`.
  - Al terminar lo cambia a `ejecutado` y completa la sección «Resultado de la ejecución».
  - Actualiza la bóveda según la sección 1.
  - Si algo del plan no se puede hacer o conviene cambiarlo, lo consulta con el usuario y lo anota en el plan.

## 3. Privacidad y seguridad
- **Nunca** pongas datos reales de clientes o del negocio en git ni en la bóveda: nombres, teléfonos, deudas, ventas, RIF ni datos bancarios de los métodos de pago.
- Los respaldos JSON exportados desde la app **nunca** se suben a git ni se copian en notas.
- **Nunca** copies en notas ni en commits el PIN, la clave maestra de cifrado ni contraseñas.
- La configuración web de Firebase (`firebaseConfig`) es pública por diseño y puede quedar en el código; la seguridad depende de las reglas de Firestore.
- Las pruebas usan solo datos ficticios.

## 4. Firebase y publicación
- Proyecto de Firebase: **`ejecomercio-27f57`** (Auth con Google y Firestore, documento `users/{uid}`).
- Las reglas de Firestore no están en el repositorio. Cambiarlas requiere aprobación explícita del usuario.
- **Hosting: GitHub Pages desde la rama `main`** del repositorio `JCZR2000/ejecomercio` (remoto `nube`). Lo que llega a `nube/main` queda publicado.
- **Publicar requiere aprobación explícita del usuario.** Publicar es llevar `DEV` a `main` (merge o pull request) y hacer push de `main` a `nube`. Más detalle en `Infraestructura.md` de la bóveda.
- Hay una etiqueta llamada `DEV` además de la rama: usa `refs/heads/DEV` en los comandos de git que lo necesiten.
- Antes de publicar:
  - Sube `CACHE_NAME` en `sw.js` a la nueva versión (`ejecomercio-vXX.Y`); si no, los teléfonos instalados siguen con la versión vieja.
  - Sirve la carpeta por HTTP en local (el Service Worker no funciona con `file://`) y prueba el flujo cambiado en el navegador, sin errores en la consola.
  - Si el cambio toca sincronización o datos guardados, prueba también con datos viejos (sección 5) y sin conexión.

## 5. Código
- La interfaz y los textos para el usuario van en español. Los nombres de variables y funciones, en inglés.
- Se mantiene la estructura actual (un `index.html` con JS vanilla) salvo que un plan decida otra cosa con el usuario.
- **Compatibilidad de datos:** los usuarios ya tienen datos en su teléfono (`localStorage`, claves `inv_*`) y en Firestore. Todo cambio en la forma de `state` o de lo guardado debe seguir leyendo los datos viejos sin perderlos ni romperlos.
- **Nunca** se escribe a la nube algo que pueda borrar datos del usuario sin una protección (como el anti-wipe actual de `saveData`).
- Toda lógica nueva de dinero, tasas, deudas o correlativo fiscal deja una pequeña prueba comprobable (por ejemplo, una función de autoprueba con `console.assert`) y se anota en el plan cómo se verificó.
- Texto que viene del usuario o de APIs externas no se inserta con `innerHTML` sin escapar.
- Las librerías por CDN llevan versión fija.

## 6. Git y cierre de cada fase
- El trabajo se hace en la rama `DEV`. El remoto se llama `nube`. Un push a `DEV` no publica; un push a `main` sí.
- Haz commit solo cuando el usuario lo pida. Los mensajes van en español y describen el cambio.
- **Al terminar una fase**, la sesión de ejecución sigue este orden:
  1. Muestra el resumen de lo hecho y de la verificación, y **pide aprobación**.
  2. Con la aprobación, **hace el commit**.
  3. **Propone de inmediato la publicación**: dice qué se publica y cómo.
  4. **Publica (o hace push) solo cuando el usuario lo confirma**, y lo anota en la nota de la versión.
- Cada versión publicada se registra en su nota de `Proyecto/Versiones`, con sus commits y su `CACHE_NAME`.

## 7. graphify (mapa del código, opcional)
- `graphify-out/` guarda un mapa del código generado por graphify. Es **solo de consulta** y no se sube a git (`.gitignore`).
- Para encontrar archivos, funciones o textos en el código, usa **Grep o Glob**: es lo más barato y exacto. graphify no se usa para eso.
- graphify solo sirve para preguntas de relación entre partes del código (`graphify query`, `graphify path`, `graphify explain`), y solo si el grafo existe y está al día.
- Tras modificar código, si existe `graphify-out/`, ejecuta `graphify update .` desde la carpeta del proyecto. No consume tokens.
- La bóveda se consulta con Grep o Read, no con graphify.
- No se usan subagentes para explorar el código con graphify, salvo que el usuario lo pida.
