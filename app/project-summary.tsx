import { ScrollView, Text, View, TouchableOpacity, Alert, FlatList } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Module {
  id: string;
  projectId: string;
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

export default function ProjectSummaryScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjectAndModules = useCallback(async () => {
    try {
      setLoading(true);

      // Cargar proyecto
      const projectsData = await AsyncStorage.getItem("projects");
      if (projectsData) {
        const projects = JSON.parse(projectsData);
        const currentProject = projects.find((p: Project) => p.id === projectId);
        if (currentProject) {
          setProject(currentProject);
        }
      }

      // Cargar módulos del proyecto
      const modulesData = await AsyncStorage.getItem("modules");
      if (modulesData) {
        const allModules = JSON.parse(modulesData);
        const projectModules = allModules.filter((m: Module) => m.projectId === projectId);
        setModules(projectModules);
      }
    } catch (error) {
      console.error("Error loading project and modules:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      loadProjectAndModules();
    }, [loadProjectAndModules])
  );

  const handleCreateModule = () => {
    router.push({
      pathname: "/cabinets/create",
      params: { projectId },
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Eliminar módulo",
      "¿Estás seguro de que deseas eliminar este módulo?",
      [
        { text: "Cancelar", onPress: () => {} },
        {
          text: "Eliminar",
          onPress: async () => {
            try {
              const updatedModules = modules.filter((m) => m.id !== id);
              const allModulesData = await AsyncStorage.getItem("modules");
              if (allModulesData) {
                const allModules = JSON.parse(allModulesData);
                const filteredModules = allModules.filter((m: Module) => m.id !== id);
                await AsyncStorage.setItem("modules", JSON.stringify(filteredModules));
              }
              setModules(updatedModules);
            } catch (error) {
              console.error("Error deleting module:", error);
              alert("Error al eliminar el módulo");
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  const handleEdit = (module: Module) => {
    router.push({
      pathname: "/cabinets/create",
      params: { moduleId: module.id, projectId },
    });
  };

  const renderModule = ({ item }: { item: Module }) => (
    <View className="bg-surface border border-border rounded-lg p-4 mb-3">
      <View className="flex-row items-start justify-between mb-2">
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
          {item.hasDrawers === true && (
            <Text className="text-xs text-muted mt-1">
              Cajones: {item.drawerCount || 1}
            </Text>
          )}
          {item.hasDoors === true && (
            <Text className="text-xs text-muted mt-1">
              Puertas: {item.doorCount || 1}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row gap-2 mt-3">
        <TouchableOpacity
          onPress={() => handleEdit(item)}
          className="flex-1 flex-row items-center justify-center bg-primary rounded-lg py-2 active:opacity-70"
        >
          <MaterialIcons name="edit" size={18} color="white" />
          <Text className="text-white font-semibold ml-2">Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          className="flex-1 flex-row items-center justify-center bg-error rounded-lg py-2 active:opacity-70"
        >
          <MaterialIcons name="delete" size={18} color="white" />
          <Text className="text-white font-semibold ml-2">Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center gap-2 mb-4"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            <Text className="text-base font-semibold text-primary">Volver</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground mb-2">{project?.name || "Proyecto"}</Text>
          <Text className="text-base text-muted">
            {modules.length} módulo{modules.length !== 1 ? "s" : ""} creado{modules.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted">Cargando módulos...</Text>
          </View>
        ) : modules.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-4">
            <MaterialIcons name="folder-open" size={48} color={colors.muted} />
            <Text className="text-lg font-semibold text-foreground">No hay módulos</Text>
            <Text className="text-sm text-muted text-center">
              Crea tu primer módulo para este proyecto
            </Text>
            <TouchableOpacity
              onPress={handleCreateModule}
              className="bg-primary rounded-lg px-6 py-3 mt-4 active:opacity-70"
            >
              <Text className="text-white font-semibold">Crear módulo</Text>
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
            <TouchableOpacity
              onPress={handleCreateModule}
              className="bg-primary rounded-lg px-6 py-3 mt-6 items-center active:opacity-70"
            >
              <Text className="text-white font-semibold">+ Crear nuevo módulo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
