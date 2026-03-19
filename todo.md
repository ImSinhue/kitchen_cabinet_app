# Project TODO - Kitchen Cabinet Designer

## Phase 1: Foundation & UI Setup
- [x] Create branding assets (logo, icon, splash screen)
- [x] Update app.config.ts with app name and branding
- [x] Design and implement color theme in theme.config.js
- [ ] Create base UI components (Card, Button, Input, Select, Modal)
- [x] Set up tab navigation with four main modules

## Phase 2: Home Screen & Navigation
- [x] Implement home screen with module shortcuts
- [x] Add recent projects list
- [ ] Implement floating action button for new project
- [x] Create tab bar with four modules (Nuevo Proyecto, Armarios, Materiales, Configuración)
- [x] Set up navigation between modules

## Phase 3: Nuevo Proyecto (New Project Wizard)
- [x] Create project wizard with 3 steps
- [ ] Step 1: Project info (name, type, dimensions)
- [ ] Step 2: Material selection (tableros, tapacantos, patas)
- [ ] Step 3: Summary and confirmation
- [ ] Implement project creation and storage
- [ ] Add validation for all input fields

## Phase 4: Armarios (Cabinet Designer)
- [x] Redesign Armarios screen with 2 main options (Crear nuevo armario, Listado de armarios)
- [x] Update Create Cabinet form: reorder dimensions (height, width, depth), add back panel options for closed type
- [x] Redesign back panel section: show as two large options (Trasera con canal / Trasera sin canal) with icons, no separate label
- [x] Reorganize cabinet type section: Sin trasera first, then Con trasera, with channel options (¿Con canal o sin canal?) as checkboxes below Con trasera
- [x] Create cabinet design canvas (2D representation)
- [ ] Implement module catalog with predefined cabinet types
- [ ] Add drag-and-drop functionality for modules
- [ ] Create module properties editor
- [ ] Implement module selection and deletion
- [ ] Add module customization (dimensions, materials, hardware)
- [ ] Create visual representation of cabinet layout

## Phase 5: Materiales (Materials Management)
- [x] Redesign materials screen with 4 main options (Create Board, Create Hardware, Board List, Hardware List)
- [x] Update Create Tablero form: predefined dimensions (2850x2100), remove color, remove grain, add material type
- [x] Update Create Board: show dialog after save (return to menu or create another)
- [x] Implement Create Herrajes (Hardware) form
- [x] Implement Listado de Tableros (Board List) screen
- [x] Implement Listado de Herrajes (Hardware List) screen
- [x] Fix delete functionality for boards (not working)
- [x] Implement edit functionality for boards (expandable form)
- [x] Add edit functionality for materials
- [x] Add delete functionality for materials
- [ ] Implement search/filter for materials

## Phase 6: Configuración (Settings)
- [x] Create settings screen with sections
- [x] Implement cutting parameters (saw thickness, trim margin)
- [x] Implement unit selection (mm/inches)
- [x] Implement optimization preferences
- [ ] Add data export functionality
- [ ] Add data import functionality
- [ ] Add data deletion with confirmation
- [x] Display app version and info

## Phase 7: Cutting List & Optimization Engine
- [ ] Design cutting list algorithm
- [ ] Implement piece calculation from cabinet design
- [ ] Implement material optimization algorithm
- [ ] Consider saw thickness and trim margins
- [ ] Handle edge banding calculations
- [ ] Generate optimized cutting patterns
- [ ] Handle different material orientations (veta)

## Phase 8: Data Persistence
- [ ] Set up SQLite database schema
- [ ] Create data models (Project, Cabinet, Material, Cutting List)
- [ ] Implement project save/load functionality
- [ ] Implement material catalog persistence
- [ ] Implement settings persistence
- [ ] Add data migration support

## Phase 9: Export Functionality
- [ ] Implement PDF export for cutting lists
- [ ] Implement PDF export for assembly drawings
- [ ] Implement CSV export for cutting lists
- [ ] Add formatting and styling to exports
- [ ] Test export on different devices

## Phase 10: Polish & Testing
- [ ] Test all user flows end-to-end
- [ ] Verify all buttons and interactions work
- [ ] Test on different screen sizes
- [ ] Implement error handling and user feedback
- [ ] Add loading indicators
- [ ] Add success/error messages
- [ ] Optimize performance
- [ ] Test data persistence

## Phase 11: Documentation & Delivery
- [ ] Create user guide/tutorial
- [ ] Document API and data structures
- [ ] Prepare release notes
- [ ] Create checkpoint for delivery
- [ ] Package application for distribution
