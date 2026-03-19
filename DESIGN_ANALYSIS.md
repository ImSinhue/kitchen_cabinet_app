# Análisis de Diseño de Módulos de Armarios

## Investigación de Aplicaciones Profesionales

### Aplicaciones Analizadas:
1. **Kitchen Planner (kitchenplanner.net)** - Planificador 3D gratuito
2. **RoomSketcher** - Software profesional 2D/3D
3. **My Kitchen: 3D Planner** - App móvil
4. **KraftMaid Visualizer** - Visualizador de marca específica

---

## Patrones Comunes Identificados

### 1. **Visualización Dual: 2D + 3D**
- **Vista 2D (Planta)**: Muestra el layout desde arriba, facilita mediciones y distribución
- **Vista 3D**: Perspectiva realista para visualizar el resultado final
- Ambas vistas se sincronizan en tiempo real

### 2. **Interfaz de Usuario**
- **Panel izquierdo**: Biblioteca de componentes (armarios, electrodomésticos, accesorios)
- **Centro**: Área de diseño principal (canvas editable)
- **Panel derecho**: Propiedades y medidas del elemento seleccionado
- **Controles superiores**: Herramientas (zoom, pan, rotación)

### 3. **Componentes Principales**
- **Armarios base** (diferentes alturas: 60cm, 80cm, 90cm)
- **Armarios altos** (múltiples alturas: 120cm, 150cm, 180cm, 200cm)
- **Armarios aéreos** (múltiples alturas)
- **Electrodomésticos** (horno, nevera, lavavajillas, etc.)
- **Accesorios** (tiradores, patas, paneles traseros)

### 4. **Funcionalidades Clave**
- **Medidas precisas**: Mostrar dimensiones en tiempo real
- **Materiales y colores**: Cambiar acabados sin rediseñar
- **Snap to grid**: Alineación automática
- **Rotación y escala**: Ajustar componentes fácilmente
- **Exportar/Imprimir**: Generar planos y especificaciones

### 5. **Flujo de Diseño Típico**
1. Crear/cargar plano base (dimensiones del espacio)
2. Agregar armarios y componentes
3. Ajustar medidas y posiciones
4. Cambiar materiales y colores
5. Visualizar en 3D
6. Exportar/compartir

---

## Propuesta de Diseño para tu App

### **Fase 1: Visualización 2D (Prioridad Alta)**

#### Pantalla Principal de Módulo
```
┌─────────────────────────────────────────────┐
│  [← Volver]  Módulo: Puerta 60cm  [Editar] │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │                                      │   │
│  │    [Visualización 2D del módulo]     │   │
│  │    - Frente (vista principal)        │   │
│  │    - Medidas anotadas                │   │
│  │    - Componentes destacados          │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  📏 Medidas:                                │
│  • Ancho: 600mm  • Alto: 720mm              │
│  • Fondo: 560mm  • Espesor: 18mm            │
│                                             │
│  🎨 Acabado:                                │
│  • Material: Melamina Blanca                │
│  • Puertas: 1 (con bisagra derecha)         │
│  • Cajones: 2 (con guías soft-close)        │
│                                             │
│  ⚙️ Componentes:                            │
│  ☑ Trasera: Sí (sin canal)                  │
│  ☑ Puertas: Sí (1)                          │
│  ☑ Cajones: Sí (2)                          │
│                                             │
│  [Editar Módulo] [Despiece] [Exportar PDF] │
└─────────────────────────────────────────────┘
```

#### Elementos Visuales Clave:
- **Dibujo 2D esquemático**: Representación clara del módulo
- **Anotaciones de medidas**: Dimensiones principales
- **Código de colores**: Diferentes componentes en colores distintos
- **Leyenda**: Explicar qué representa cada color/símbolo

### **Fase 2: Despiece Técnico (Prioridad Alta)**

#### Pantalla de Despiece
```
┌─────────────────────────────────────────────┐
│  [← Volver]  Despiece del Módulo            │
├─────────────────────────────────────────────┤
│                                             │
│  📋 LISTA DE COMPONENTES                    │
│                                             │
│  ┌─ TABLEROS ──────────────────────────┐   │
│  │ • Laterales (2x): 560×720×18mm      │   │
│  │ • Fondo (1x): 600×720×3mm           │   │
│  │ • Base (1x): 600×560×18mm           │   │
│  │ • Divisor (1x): 600×560×18mm        │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─ PUERTAS ──────────────────────────┐    │
│  │ • Puerta frontal (1x): 580×680×18mm│    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─ CAJONES ──────────────────────────┐    │
│  │ • Frente cajón (2x): 580×200×18mm  │    │
│  │ • Laterales cajón (4x): 500×180×... │    │
│  │ • Fondo cajón (2x): 580×500×...     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─ HERRAJES ─────────────────────────┐    │
│  │ • Bisagras (2x)                     │    │
│  │ • Guías soft-close (2x)             │    │
│  │ • Tirador (3x)                      │    │
│  │ • Patas ajustables (4x)             │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Exportar PDF] [Imprimir] [Compartir]     │
└─────────────────────────────────────────────┘
```

### **Fase 3: Visualización 3D (Prioridad Media)**

#### Opciones:
- **SVG 3D isométrico**: Dibujo 2D con perspectiva 3D
- **Canvas 3D**: Renderización básica con Three.js
- **AR Preview**: Visualizar en el espacio real (futuro)

---

## Recomendaciones de Implementación

### **Corto Plazo (MVP)**
1. ✅ Pantalla de detalle del módulo con medidas
2. ✅ Visualización 2D esquemática (SVG)
3. ✅ Listado de componentes (despiece)
4. ✅ Exportar a PDF con especificaciones

### **Mediano Plazo**
1. Visualización 3D isométrica
2. Editor visual de módulos (drag & drop)
3. Galería de acabados y materiales
4. Cálculo automático de herrajes

### **Largo Plazo**
1. Visualización 3D interactiva (Three.js)
2. AR Preview (escanear espacio)
3. Integración con proveedores
4. Generación automática de planos de corte

---

## Tecnologías Recomendadas

- **SVG**: Dibujos 2D escalables y precisos
- **React Native SVG**: Componentes gráficos
- **Three.js**: Visualización 3D (si es necesario)
- **PDF Generation**: Exportar especificaciones
- **Canvas API**: Renderización de gráficos complejos

---

## Próximos Pasos

1. Crear pantalla de detalle del módulo
2. Implementar visualización 2D con SVG
3. Generar tabla de despiece automática
4. Agregar funcionalidad de exportar PDF
