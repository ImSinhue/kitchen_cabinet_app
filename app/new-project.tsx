import { useState, useCallback, useEffect } from "react";
import { ScrollView, Text, View, TextInput, Pressable, Alert, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
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

type FilterType = "all" | "alto" | "bajo" | "columna";

export default function NewProjectScreen() {
  const router = useRouter();
  const colors = useColors();
  const [projectName, setProjectName] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModules, setSelectedModules] = useState<Map<string, number>>(new Map());
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [loading, setLoading] = useState(false);

  const loadModules = useCallback(async () => {
    try {
      const modulesData = await AsyncStorage.getItem("modules");
      console.log("Modules data from AsyncStorage:", modulesData);
      if (modulesData) {
        const allModules = JSON.parse(modulesData);
        console.log("All modules:", allModules);
        const seenIds = new Set<string>();
        const uniqueModules = allModules.filter((m: Module) => {
          if (seenIds.has(m.id)) {
            return false;
          }
          seenIds.add(m.id);
          return true;
        });
        console.log("Unique modules:", uniqueModules);
        setModules(uniqueModules);
      } else {
        console.log("No modules data found in AsyncStorage");
        setModules([]);
      }
    } catch (error) {
      console.error("Error loading modules:", error);
    }
  }, []);

  useEffect(() => {
    loadModules();
  }, []);

  const getFilteredModules = () => {
    if (filterType === "all") {
      return modules;
    }
    return modules.filter((m) => m.moduleHeight === filterType);
  };

  const incrementModule = (moduleId: string) => {
    const newSelected = new Map(selectedModules);
    const currentQuantity = newSelected.get(moduleId) || 0;
    newSelected.set(moduleId, currentQuantity + 1);
    setSelectedModules(newSelected);
  };

  const decrementModule = (moduleId: string) => {
    const newSelected = new Map(selectedModules);
    const currentQuantity = newSelected.get(moduleId) || 0;
    const newQuantity = Math.max(0, currentQuantity - 1);
    if (newQuantity === 0) {
      newSelected.delete(moduleId);
    } else {
      newSelected.set(moduleId, newQuantity);
    }
    setSelectedModules(newSelected);
  };

  const handleSaveProject = async () => {
    console.log("handleSaveProject called");
    console.log("projectName:", projectName);
    console.log("selectedModules:", selectedModules);
    if (!projectName.trim()) {
      console.log("Project name is empty");
      Alert.alert("Error", "Por favor ingresa un nombre para el proyecto");
      return;
    }

    try {
      console.log("Starting project save...");
      setLoading(true);
      const newProject: Project = {
        id: Date.now().toString(),
        name: projectName.trim(),
        createdAt: new Date().toISOString(),
      };

      const existingProjects = await AsyncStorage.getItem("projects");
      const projects = existingProjects ? JSON.parse(existingProjects) : [];
      projects.push(newProject);
      await AsyncStorage.setItem("projects", JSON.stringify(projects));

      if (selectedModules.size > 0) {
        const modulesData = await AsyncStorage.getItem("modules");
        if (modulesData) {
          const allModules = JSON.parse(modulesData);
          const projectModules: Module[] = [];
          selectedModules.forEach((quantity, moduleId) => {
            const baseModule = allModules.find((m: Module) => m.id === moduleId);
            if (baseModule) {
              for (let i = 0; i < quantity; i++) {
                projectModules.push({
                  ...baseModule,
                  projectId: newProject.id,
                  instanceId: `${moduleId}-${i}`,
                } as Module);
              }
            }
          });
          const allModulesWithProject = [...allModules, ...projectModules];
          await AsyncStorage.setItem("modules", JSON.stringify(allModulesWithProject));
        }
      }

      console.log("Project saved successfully, showing alert");
      // Limpiar formularios
      setProjectName("");
      setSelectedModules(new Map());
      setFilterType("all");
      Alert.alert("Éxito", "Proyecto creado correctamente", [
        {
          text: "OK",
          onPress: () => {
            router.push({
              pathname: "/project-summary",
              params: { projectId: newProject.id },
            });
          },
        },
      ]);
    } catch (error) {
      console.error("Error creating project:", error);
      Alert.alert("Error", "No se pudo crear el proyecto");
    } finally {
      setLoading(false);
    }
  };

  const filteredModules = getFilteredModules();

  const renderModule = ({ item }: { item: Module }) => {
    const quantity = selectedModules.get(item.id) || 0;
    return (
      <View>
        <View className="bg-surface p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <View className="flex-row items-center gap-3">
                <Text className="text-lg font-bold text-foreground flex-1">{item.name}</Text>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => decrementModule(item.id)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="bg-primary rounded-lg p-3"
                  >
                    <MaterialIcons name="remove" size={24} color="white" />
                  </Pressable>
                  <View className="bg-primary rounded-lg px-3 py-1 min-w-12 items-center">
                    <Text className="text-white font-bold text-center">{quantity}</Text>
                  </View>
                  <Pressable
                    onPress={() => incrementModule(item.id)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="bg-primary rounded-lg p-3"
                  >
                    <MaterialIcons name="add" size={24} color="white" />
                  </Pressable>
                </View>
              </View>
              <Text className="text-sm text-muted mt-2">
                {item.height}mm × {item.width}mm × {item.depth}mm
              </Text>
              {item.moduleHeight && (
                <Text className="text-xs text-muted mt-1 capitalize">
                  Altura: {item.moduleHeight === "alto" ? "Alto" : item.moduleHeight === "bajo" ? "Bajo" : "Columna"}
                </Text>
              )}
            </View>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
      </View>
    );
  };

  const totalModulesSelected = Array.from(selectedModules.values()).reduce((a, b) => a + b, 0);

  return (
    <ScreenContainer className="p-6">
      <View style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Scrollable Content */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          <View className="gap-6">
            {/* Title */}
            <Text className="text-3xl font-bold text-foreground">Nuevo Proyecto</Text>

            {/* Project Name Input */}
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Nombre del Proyecto</Text>
              <TextInput
                value={projectName}
                onChangeText={setProjectName}
                placeholder="Escribe el nombre del proyecto"
                placeholderTextColor={colors.muted}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-base text-foreground"
                editable={!loading}
              />
            </View>

            {/* Filter Buttons */}
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Filtrar por altura</Text>
              <View className="flex-row gap-2 flex-wrap">
                {(["all", "alto", "bajo", "columna"] as const).map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setFilterType(type)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className={`rounded-lg px-4 py-2 ${
                      filterType === type ? "bg-primary" : "bg-surface border border-border"
                    }`}
                  >
                    <Text
                      className={`font-semibold text-sm ${
                        filterType === type ? "text-white" : "text-foreground"
                      }`}
                    >
                      {type === "all"
                        ? "Todos"
                        : type === "alto"
                        ? "Alto"
                        : type === "bajo"
                        ? "Bajo"
                        : "Columna"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Modules List */}
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Módulos disponibles ({filteredModules.length})
              </Text>
              {filteredModules.length === 0 ? (
                <View className="items-center justify-center py-8">
                  <MaterialIcons name="folder-open" size={48} color={colors.muted} />
                  <Text className="text-base text-muted mt-2">No hay módulos disponibles</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredModules}
                  renderItem={renderModule}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              )}
            </View>
          </View>
        </ScrollView>

        {/* Fixed Footer with Buttons */}
        <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View className="flex-row gap-3">
            {/* Save Button */}
            <Pressable
              onPress={handleSaveProject}
              disabled={loading}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                flex: 1,
                backgroundColor: loading ? colors.primary : colors.primary,
                borderRadius: 8,
                paddingVertical: 16,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              })}
            >
              <MaterialIcons name="save" size={24} color="white" />
              <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                {loading ? "Guardando..." : `Guardar (${totalModulesSelected})`}
              </Text>
            </Pressable>

            {/* Cancel Button */}
            <Pressable
              onPress={() => router.back()}
              disabled={loading}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingVertical: 16,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              })}
            >
              <MaterialIcons name="close" size={24} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 16 }}>
                Cancelar
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
