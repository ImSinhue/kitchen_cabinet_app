import { ScrollView, Text, View, TouchableOpacity, FlatList, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { useCallback, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Module {
  id: string;
  projectId?: string;
  name: string;
  height: string;
  width: string;
  depth: string;
  type: "no-back" | "with-back" | null;
  moduleHeight?: "alto" | "bajo" | "columna" | null;
  hasDrawers?: boolean | null;
  drawerCount?: number | null | undefined;
  hasDoors?: boolean | null;
  doorCount?: number | null | undefined;
}

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export default function SelectModulesScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  const projectName = params.projectName as string;

  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      setLoading(true);
      const modulesData = await AsyncStorage.getItem("modules");
      if (modulesData) {
        const allModules = JSON.parse(modulesData);
        // Filtrar módulos que no tengan projectId (módulos globales sin asignar)
        const availableModules = allModules.filter((m: Module) => !m.projectId);
        setModules(availableModules);
      }
    } catch (error) {
      console.error("Error loading modules:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleModuleSelection = (moduleId: string) => {
    const newSelected = new Set(selectedModuleIds);
    if (newSelected.has(moduleId)) {
      newSelected.delete(moduleId);
    } else {
      newSelected.add(moduleId);
    }
    setSelectedModuleIds(newSelected);
  };

  const handleFinish = async () => {
    try {
      setLoading(true);

      // Actualizar módulos seleccionados con el projectId
      const modulesData = await AsyncStorage.getItem("modules");
      if (modulesData) {
        const allModules = JSON.parse(modulesData);
        const updatedModules = allModules.map((m: Module) => {
          if (selectedModuleIds.has(m.id)) {
            return { ...m, projectId };
          }
          return m;
        });
        await AsyncStorage.setItem("modules", JSON.stringify(updatedModules));
      }

      // Navegar a project-summary
      router.push({
        pathname: "/project-summary",
        params: { projectId },
      });
    } catch (error) {
      console.error("Error finishing project creation:", error);
      Alert.alert("Error", "No se pudo finalizar la creación del proyecto");
    } finally {
      setLoading(false);
    }
  };

  const renderModule = ({ item }: { item: Module }) => {
    const isSelected = selectedModuleIds.has(item.id);
    return (
      <TouchableOpacity
        onPress={() => toggleModuleSelection(item.id)}
        className={`bg-surface border-2 rounded-lg p-4 mb-3 ${
          isSelected ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{item.name}</Text>
            <Text className="text-sm text-muted mt-1">
              {item.height}mm × {item.width}mm × {item.depth}mm
            </Text>
            <Text className="text-xs text-muted mt-1">
              Tipo: {item.type === "with-back" ? "Con trasera" : "Sin trasera"}
            </Text>
            {item.moduleHeight && (
              <Text className="text-xs text-muted mt-1">
                Altura: {item.moduleHeight === "alto" ? "Alto" : item.moduleHeight === "bajo" ? "Bajo" : "Columna"}
              </Text>
            )}
          </View>
          <View className="ml-4">
            {isSelected ? (
              <View className="bg-primary rounded-full p-2">
                <MaterialIcons name="check" size={20} color="white" />
              </View>
            ) : (
              <View className="bg-border rounded-full p-2">
                <MaterialIcons name="add" size={20} color={colors.muted} />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center gap-2 mb-4"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            <Text className="text-base font-semibold text-primary">Volver</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground mb-2">Agregar Módulos</Text>
          <Text className="text-base text-muted">
            Proyecto: <Text className="font-semibold text-foreground">{projectName}</Text>
          </Text>
          <Text className="text-sm text-muted mt-2">
            Selecciona los módulos que deseas agregar a este proyecto
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted">Cargando módulos...</Text>
          </View>
        ) : modules.length === 0 ? (
          <View className="items-center justify-center gap-4 py-12">
            <MaterialIcons name="folder-open" size={48} color={colors.muted} />
            <Text className="text-lg font-semibold text-foreground">No hay módulos disponibles</Text>
            <Text className="text-sm text-muted text-center">
              Crea módulos primero en la sección "Armarios"
            </Text>
            <TouchableOpacity
              onPress={() => {
                router.push({
                  pathname: "/project-summary",
                  params: { projectId },
                });
              }}
              className="bg-primary rounded-lg px-6 py-3 mt-4 active:opacity-70"
            >
              <Text className="text-white font-semibold">Continuar sin módulos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-1">
            <FlatList
              data={modules}
              renderItem={renderModule}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />

            <View className="gap-3 mt-6">
              <TouchableOpacity
                onPress={handleFinish}
                disabled={loading}
                className={`rounded-lg py-4 items-center justify-center ${
                  loading ? "bg-primary opacity-50" : "bg-primary active:opacity-80"
                }`}
              >
                <Text className="text-white font-semibold text-base">
                  {loading ? "Finalizando..." : `Finalizar (${selectedModuleIds.size} seleccionados)`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.back()}
                disabled={loading}
                className="rounded-lg py-4 items-center justify-center border border-border"
              >
                <Text className="text-foreground font-semibold text-base">Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
