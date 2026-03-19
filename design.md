# Diseño de Interfaz de Usuario - Kitchen Cabinet Designer

## Visión General
La aplicación Kitchen Cabinet Designer está diseñada para carpinteros, diseñadores de interiores y usuarios finales que deseen diseñar y fabricar armarios de cocina con precisión. La interfaz debe ser intuitiva, profesional y optimizada para uso con una mano en orientación vertical (9:16).

## Paleta de Colores
- **Primary:** `#0a7ea4` (Azul profesional) - Botones principales, acentos
- **Background:** `#ffffff` (Blanco) - Fondo principal en modo claro
- **Surface:** `#f5f5f5` (Gris claro) - Tarjetas, superficies elevadas
- **Foreground:** `#11181C` (Gris oscuro) - Texto principal
- **Muted:** `#687076` (Gris medio) - Texto secundario
- **Success:** `#22C55E` (Verde) - Confirmaciones, estados positivos
- **Error:** `#EF4444` (Rojo) - Errores, advertencias

## Pantallas Principales

### 1. Pantalla de Inicio (Home/Dashboard)
**Ubicación:** `app/(tabs)/index.tsx`

**Contenido:**
- Encabezado con título "Kitchen Cabinet Designer"
- Acceso rápido a los cuatro módulos principales mediante tarjetas grandes
- Listado de proyectos recientes (últimos 5 proyectos)
- Botón flotante para crear nuevo proyecto

**Funcionalidad:**
- Navegar a cada módulo principal
- Abrir proyectos recientes
- Crear nuevo proyecto

### 2. Módulo: Nuevo Proyecto
**Pantalla:** New Project Wizard

**Flujo:**
1. **Paso 1 - Información General:**
   - Campo de texto: Nombre del proyecto
   - Selector: Tipo de cocina (Modular, Lineal, L, U)
   - Campos numéricos: Ancho, alto, profundidad de la cocina (mm)

2. **Paso 2 - Material Base:**
   - Selector de tablero predeterminado (con preview de color)
   - Selector de tapacantos predeterminado
   - Opción: Incluir zócalo (sí/no)
   - Opción: Tipo de patas (regulables, fijas, sin patas)

3. **Paso 3 - Resumen:**
   - Mostrar resumen de configuración
   - Botón: Crear Proyecto
   - Botón: Volver a editar

**Componentes:**
- Stepper visual (1/2/3)
- Campos de entrada con validación
- Selectores con preview visual

### 3. Módulo: Armarios
**Pantalla:** Cabinet Designer

**Contenido:**
- **Panel Superior:** Nombre del proyecto y herramientas de vista
- **Área Central:** Lienzo de diseño (2D simplificado) mostrando la distribución de módulos
- **Panel Lateral Derecho:** Catálogo de módulos disponibles (scroll vertical)
- **Panel Inferior:** Propiedades del módulo seleccionado (editable)

**Funcionalidad:**
- Arrastrar módulos del catálogo al lienzo
- Seleccionar módulos en el lienzo para editar propiedades
- Ajustar dimensiones, materiales y herrajes
- Eliminar módulos
- Vista previa 3D simplificada (opcional)

**Catálogo de Módulos:**
- Módulos Bajos (80-90 cm alto)
  - Módulo con puertas (1, 2, 3 puertas)
  - Módulo con cajones
  - Módulo para fregadero
  - Módulo para horno/microondas

- Módulos Altos (200-240 cm alto)
  - Módulo con puertas (1, 2, 3 puertas)
  - Módulo abierto (estantes)
  - Módulo despensero

- Columnas (60 cm ancho)
  - Columna para horno
  - Columna para frigorífico
  - Columna despensera

- Esquineros
  - Módulo ciego (rincón)
  - Módulo extraíble (carrusel)

### 4. Módulo: Materiales
**Pantalla:** Materials Catalog

**Contenido:**
- **Pestaña 1: Tableros**
  - Listado de tableros disponibles
  - Para cada tablero: nombre, dimensiones, espesor, veta, color
  - Botón: Agregar nuevo tablero
  - Botón: Editar/Eliminar

- **Pestaña 2: Tapacantos**
  - Listado de tapacantos
  - Para cada tapacanto: nombre, espesor, color
  - Botón: Agregar nuevo
  - Botón: Editar/Eliminar

- **Pestaña 3: Herrajes**
  - Listado de herrajes (bisagras, correderas, tiradores)
  - Para cada herraje: nombre, tipo, especificaciones
  - Botón: Agregar nuevo
  - Botón: Editar/Eliminar

**Funcionalidad:**
- Ver catálogo de materiales
- Agregar nuevos materiales personalizados
- Editar materiales existentes
- Eliminar materiales (con confirmación)
- Buscar/filtrar materiales

### 5. Módulo: Configuración
**Pantalla:** Settings

**Contenido:**
- **Sección: Parámetros de Corte**
  - Campo numérico: Grosor del disco de sierra (mm)
  - Campo numérico: Margen de refilado (mm)

- **Sección: Unidades de Medida**
  - Selector: Milímetros (mm) o Pulgadas (in)

- **Sección: Preferencias de Optimización**
  - Selector: Prioridad (Mínimo desperdicio / Velocidad de corte)

- **Sección: Datos y Privacidad**
  - Botón: Exportar datos
  - Botón: Importar datos
  - Botón: Borrar todos los datos (con confirmación)

- **Sección: Acerca de**
  - Versión de la aplicación
  - Información del desarrollador

**Funcionalidad:**
- Cambiar configuración de corte
- Cambiar unidades de medida
- Exportar/importar proyectos
- Gestionar datos

## Flujos de Usuario Principales

### Flujo 1: Crear y Diseñar un Proyecto
1. Usuario abre la aplicación (Home)
2. Toca "Nuevo Proyecto"
3. Completa el wizard (3 pasos)
4. Se abre el módulo Armarios
5. Arrastra módulos del catálogo al lienzo
6. Ajusta propiedades de cada módulo
7. Guarda el proyecto

### Flujo 2: Generar Despiece
1. Usuario está en el módulo Armarios
2. Toca botón "Generar Despiece"
3. Se abre diálogo con opciones de exportación
4. Selecciona formato (PDF o CSV)
5. Se genera y descarga el archivo

### Flujo 3: Personalizar Materiales
1. Usuario va al módulo Materiales
2. Selecciona pestaña (Tableros, Tapacantos, Herrajes)
3. Toca "Agregar nuevo"
4. Completa formulario con especificaciones
5. Guarda el material
6. El material aparece en el catálogo

## Consideraciones de Diseño

### Usabilidad Móvil
- Botones y elementos interactivos tienen mínimo 44x44 pt
- Espaciado adecuado entre elementos (8, 12, 16, 24 pt)
- Texto legible (mínimo 12 pt para cuerpo, 16 pt para títulos)
- Colores con suficiente contraste para accesibilidad

### Orientación Vertical (9:16)
- Diseño optimizado para una mano
- Elementos principales en la mitad inferior de la pantalla
- Scroll vertical para contenido extenso
- Barra de pestañas en la parte inferior

### Retroalimentación Visual
- Botones con estado presionado (escala 0.97, opacidad)
- Indicadores de carga para operaciones largas
- Mensajes de confirmación/error claros
- Animaciones sutiles (sin exceso)

### Accesibilidad
- Contraste suficiente entre texto y fondo
- Etiquetas claras para todos los campos
- Soporte para lectores de pantalla
- Tamaños de fuente escalables

## Componentes Reutilizables

- `ScreenContainer` - Envoltorio de pantalla con SafeArea
- `Card` - Tarjeta con sombra y bordes
- `Button` - Botón primario/secundario
- `Input` - Campo de entrada de texto
- `Select` - Selector desplegable
- `Stepper` - Indicador de pasos
- `Modal` - Diálogo modal
- `Toast` - Notificación flotante
