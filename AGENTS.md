# Instrucciones para agentes

Antes de hacer cualquier cosa en este proyecto, lee **[REGLAS.md](REGLAS.md)** y síguelo.

La fuente principal de contexto (qué se hizo, qué falta, decisiones y versiones) es la bóveda de Obsidian, en:

```
C:\Users\juan2\Documentos\Obsidian\EjeComercio
```

Empieza por `Proyecto/Estado actual.md` y registra en la bóveda tu trabajo al terminar, como indica REGLAS.md.

Antes de planificar algo que toque datos, sincronización, dominio o Service Worker, lee «Dónde viven los datos» (REGLAS.md, sección 5) y compruébalo en el código. La sesión con Google es obligatoria y todo lo importante se sube a Firebase: el teléfono guarda una copia, no la única.

Antes de planificar o cambiar código, haz la «Revisión de impacto» (REGLAS.md, sección 5): nota del módulo en la bóveda, Grep de los llamadores, graphify (si existe `graphify-out/`) para las relaciones y lectura del código alrededor. Anota qué más puede afectar y pruébalo también.
