'use client';

import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View, Pressable, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { SvgXml } from 'react-native-svg';

interface Module {
  id: string;
  name: string;
  width: string;
  height: string;
  depth: string;
  hasDoors: boolean;
  hasDrawers: boolean;
  doorCount: number;
  drawerCount: number;
  backPanel: boolean;
}

export default function ModuleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModule();
  }, [id]);

  const loadModule = async () => {
    try {
      const modulesJson = await AsyncStorage.getItem('modules');
      if (modulesJson) {
        const modules = JSON.parse(modulesJson);
        const found = modules.find((m: Module) => m.id === id);
        if (found) {
          setModule(found);
        }
      }
    } catch (error) {
      console.error('Error loading module:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <Text className="text-center text-foreground">Cargando...</Text>
      </ScreenContainer>
    );
  }

  if (!module) {
    return (
      <ScreenContainer>
        <Text className="text-center text-foreground">Módulo no encontrado</Text>
      </ScreenContainer>
    );
  }

  // Generate 3D isometric visualization
  const generateModule3D = (mod: Module) => {
    const width = parseInt(mod.width) || 600;
    const height = parseInt(mod.height) || 720;
    const depth = parseInt(mod.depth) || 560;

    const lineColor = '#0066CC'; // Blue lines like the sketch
    const lineWidth = 2;

    const drawerCount = mod.drawerCount || 0;
    const doorCount = mod.doorCount || 0;

    // Isometric projection parameters
    const scale = 0.08; // Scale factor to fit in SVG
    const w = width * scale;
    const h = height * scale;
    const d = depth * scale;

    // Isometric angles (30 degrees)
    const angle = Math.PI / 6; // 30 degrees
    const cos30 = Math.cos(angle);
    const sin30 = Math.sin(angle);

    // Origin point
    const ox = 100;
    const oy = 120;

    // Calculate all 8 corner points of the cube
    // Front face
    const p1 = { x: ox, y: oy }; // top-left
    const p2 = { x: ox + w, y: oy }; // top-right
    const p3 = { x: ox + w, y: oy + h }; // bottom-right
    const p4 = { x: ox, y: oy + h }; // bottom-left

    // Back face (with depth offset)
    const dx = d * cos30;
    const dy = d * sin30;
    const p5 = { x: ox + dx, y: oy + dy }; // top-left back
    const p6 = { x: ox + w + dx, y: oy + dy }; // top-right back
    const p7 = { x: ox + w + dx, y: oy + h + dy }; // bottom-right back
    const p8 = { x: ox + dx, y: oy + h + dy }; // bottom-left back

    // Generate door lines (vertical divisions on front face)
    let doorLines = '';
    if (mod.hasDoors && doorCount > 0) {
      const doorWidth = w / doorCount;
      for (let i = 1; i < doorCount; i++) {
        const x = p1.x + doorWidth * i;
        doorLines += `<line x1="${x}" y1="${p1.y}" x2="${x}" y2="${p4.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>`;
      }
    }

    // Generate drawer lines (horizontal divisions on front face)
    let drawerLines = '';
    if (mod.hasDrawers && drawerCount > 0) {
      const drawerHeight = h / drawerCount;
      for (let i = 1; i < drawerCount; i++) {
        const y = p1.y + drawerHeight * i;
        drawerLines += `<line x1="${p1.x}" y1="${y}" x2="${p2.x}" y2="${y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>`;
      }
    }

    let svg = `
      <svg width="320" height="280" viewBox="0 0 320 280" xmlns="http://www.w3.org/2000/svg">
        <!-- Background -->
        <rect width="320" height="280" fill="white"/>
        
        <!-- Front face (main rectangle) -->
        <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        <line x1="${p2.x}" y1="${p2.y}" x2="${p3.x}" y2="${p3.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        <line x1="${p3.x}" y1="${p3.y}" x2="${p4.x}" y2="${p4.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        <line x1="${p4.x}" y1="${p4.y}" x2="${p1.x}" y2="${p1.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        
        <!-- Top face -->
        <line x1="${p1.x}" y1="${p1.y}" x2="${p5.x}" y2="${p5.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        <line x1="${p5.x}" y1="${p5.y}" x2="${p6.x}" y2="${p6.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        <line x1="${p6.x}" y1="${p6.y}" x2="${p2.x}" y2="${p2.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        
        <!-- Right face -->
        <line x1="${p2.x}" y1="${p2.y}" x2="${p6.x}" y2="${p6.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        <line x1="${p6.x}" y1="${p6.y}" x2="${p7.x}" y2="${p7.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        <line x1="${p7.x}" y1="${p7.y}" x2="${p3.x}" y2="${p3.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        
        <!-- Back bottom edge -->
        <line x1="${p5.x}" y1="${p5.y}" x2="${p8.x}" y2="${p8.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        <line x1="${p8.x}" y1="${p8.y}" x2="${p7.x}" y2="${p7.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        
        <!-- Left face back edge -->
        <line x1="${p4.x}" y1="${p4.y}" x2="${p8.x}" y2="${p8.y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>
        
        <!-- Door divisions on front face -->
        ${doorLines}
        
        <!-- Drawer divisions on front face -->
        ${drawerLines}
        
        <!-- Dimension labels - positioned like the sketch -->
        <!-- Height (left side) -->
        <text x="${ox - 25}" y="${oy + h / 2}" font-size="14" font-weight="bold" fill="${lineColor}">${mod.height}</text>
        
        <!-- Width (bottom) -->
        <text x="${ox + w / 2 - 15}" y="${oy + h + 25}" font-size="14" font-weight="bold" fill="${lineColor}">${mod.width}</text>
        
        <!-- Depth (right side) -->
        <text x="${ox + w + dx + 15}" y="${oy + h / 2 + dy + 5}" font-size="14" font-weight="bold" fill="${lineColor}">${mod.depth}</text>
      </svg>
    `;

    return svg;
  };

  // Generate component list (despiece)
  const generateDespiece = (mod: Module) => {
    const components = [];

    // Main panels
    components.push({
      name: 'Tablero Frontal',
      width: mod.width,
      height: mod.height,
      depth: '18',
      quantity: 1,
    });

    components.push({
      name: 'Tablero Trasero',
      width: mod.width,
      height: mod.height,
      depth: '3',
      quantity: mod.backPanel ? 1 : 0,
    });

    // Lateral panels
    components.push({
      name: 'Tableros Laterales',
      width: mod.depth,
      height: mod.height,
      depth: '18',
      quantity: 2,
    });

    // Top and bottom panels
    components.push({
      name: 'Tablero Superior/Inferior',
      width: mod.width,
      height: mod.depth,
      depth: '18',
      quantity: 2,
    });

    // Doors
    if (mod.hasDoors && mod.doorCount > 0) {
      const doorWidth = Math.floor(parseInt(mod.width) / mod.doorCount - 2);
      components.push({
        name: 'Puertas',
        width: doorWidth.toString(),
        height: mod.height,
        depth: '18',
        quantity: mod.doorCount,
      });
    }

    // Drawers
    if (mod.hasDrawers && mod.drawerCount > 0) {
      const drawerHeight = Math.floor(parseInt(mod.height) / mod.drawerCount - 2);
      components.push({
        name: 'Cajones',
        width: mod.width,
        height: drawerHeight.toString(),
        depth: mod.depth,
        quantity: mod.drawerCount,
      });
    }

    return components.filter((c) => c.quantity > 0);
  };

  const svg3D = generateModule3D(module);
  const despiece = generateDespiece(module);

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">{module.name}</Text>
          <Text className="text-sm text-muted mt-1">
            {module.width} × {module.height} × {module.depth} mm
          </Text>
        </View>

        {/* 3D Visualization */}
        <View className="mb-6 bg-surface rounded-lg p-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Visualización 3D</Text>
          <View className="items-center">
            <SvgXml xml={svg3D} width="320" height="280" />
          </View>
        </View>

        {/* Configuration */}
        <View className="mb-6 bg-surface rounded-lg p-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Configuración</Text>
          <View className="gap-2">
            <Text className="text-sm text-foreground">
              Trasera: <Text className="font-semibold">{module.backPanel ? 'Sí' : 'No'}</Text>
            </Text>
            <Text className="text-sm text-foreground">
              Puertas: <Text className="font-semibold">{module.hasDoors ? `Sí (${module.doorCount})` : 'No'}</Text>
            </Text>
            <Text className="text-sm text-foreground">
              Cajones: <Text className="font-semibold">{module.hasDrawers ? `Sí (${module.drawerCount})` : 'No'}</Text>
            </Text>
          </View>
        </View>

        {/* Despiece Técnico */}
        <View className="mb-6 bg-surface rounded-lg p-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Despiece Técnico</Text>
          {despiece.map((component, index) => (
            <View key={index} className="mb-3 pb-3 border-b border-border last:border-b-0">
              <Text className="font-semibold text-foreground">{component.name}</Text>
              <Text className="text-xs text-muted mt-1">
                {component.width} × {component.height} × {component.depth} mm | Cantidad: {component.quantity}
              </Text>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View className="gap-3 mt-6">
          <Pressable
            onPress={() => {
              Alert.alert('Exportar PDF', 'Funcionalidad en desarrollo');
            }}
            style={({ pressed }) => [
              {
                backgroundColor: '#0a7ea4',
                padding: 12,
                borderRadius: 8,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text className="text-white font-semibold text-center">Exportar PDF</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              router.push({
                pathname: '/cabinets/create',
                params: { moduleId: module.id },
              });
            }}
            style={({ pressed }) => [
              {
                backgroundColor: '#0a7ea4',
                padding: 12,
                borderRadius: 8,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text className="text-white font-semibold text-center">Editar Módulo</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
